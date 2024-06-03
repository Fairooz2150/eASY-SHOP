var express = require('express');
var router = express.Router();
var productHelpers=require('../helpers/product-helpers');
const userHelpers=require('../helpers/user-helpers');
const { log } = require('console');
const verifyLogin=(req,res,next)=>{
  if(req.session.userLoggedIn){
  next()
  }else{
    res.redirect('/login')
  }
}

/* GET home page. */


router.get('/', async function(req, res, next) {
 let user=req.session.user
console.log(user);
var cartCount=null
if(req.session.user) {
  cartCount=await userHelpers.getCartCount(req.session.user._id)}
  productHelpers.getAllProducts().then((products)=>{
    
    res.render('user/view-products',{products,user,cartCount})
  })
  });

  router.get('/login',(req,res)=>{
    if(req.session.user){
      res.redirect('/')}
      else{
        res.render('user/login',{"loginErr":req.session.userLoginErr,adminOption:true})
        req.session.userLoginErr=false
      }
  })
router.get('/signup',(req,res)=>{
  res.render('user/signup')
})
router.post('/signup',(req,res)=>{
  userHelpers.doSignup(req.body).then((response)=>{
    console.log(response);
    
    req.session.user=response
    req.session.userLoggedIn=true
    res.redirect('/')

  })
})
router.post('/login',(req,res)=>{
  userHelpers.doLogin(req.body).then((response)=>{
    if(response.status){
   
      req.session.user=response.user
      req.session.userLoggedIn=true
      res.redirect('/')
    }else{
      req.session.userLoginErr="Invalid Username or Password"
      res.redirect('/login')
    }
  })
})
router.get('/logout',(req,res)=>{
  req.session.user=null
  req.session.userLoggedIn=false
  res.redirect('/')
})
router.get('/cart',verifyLogin,async (req,res)=>{
  let products=await userHelpers.getCartProducts(req.session.user._id)
  let totalValue=0;
  let placeOrder=false
  if(products.length>0){
    totalValue=await userHelpers.getTotalAmount(req.session.user._id)
   placeOrder=true
  }
  if(req.session.user) {
    cartCount=await userHelpers.getCartCount(req.session.user._id)
  }
  console.log(products);
  let user=req.session.user;
  res.render('user/cart',{products,user,totalValue,cartCount,placeOrder})
})

router.get('/add-to-cart/:id',(req,res)=>{
  console.log("api call");
   userHelpers.addToCart(req.params.id,req.session.user._id).then(()=>{
res.json({status:true})
  })
})


router.post('/change-product-quantity',(req,res,next)=>{
  console.log(req.body);

  userHelpers.changeProductQuantity(req.body).then(async(response)=>{
    response.total=await userHelpers.getTotalAmount(req.body.user)
    res.json(response)
  })
}) 
router.get('/place-order',verifyLogin,async (req,res)=>{
  let total=await userHelpers.getTotalAmount(req.session.user._id)

  res.render('user/place-order',{total,user:req.session.user})
})

router.post('/place-order', async (req, res) => {
  try {
    const userId = req.body.userId;
    const paymentMethod = req.body['payment-method'];

    // Get cart products and total price
    const products = await userHelpers.getCartProductList(userId);
    const totalPrice = await userHelpers.getTotalAmount(userId);

    // Place the order
    const orderId = await userHelpers.placeOrder(req.body, products, totalPrice);

    // Handle payment method
    if (paymentMethod === 'COD') {
      res.json({ codSuccess: true });
    } else {
      const response = await userHelpers.generateRazorpay(orderId, totalPrice);
      res.json(response);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong, please try again later.' });
  }
});




router.get('/order-success',verifyLogin,(req,res)=>{
  res.render('user/order-success',{user:req.session.user})
})

router.get('/orders', verifyLogin, async (req, res) => {
  let cartCount = 0;
  if (req.session.user) {
      cartCount = await userHelpers.getCartCount(req.session.user._id);
  }

  userHelpers.getAllUserOrders(req.session.user._id).then((orders) => {
      // Sort orders by date in descending order
      orders.sort((a, b) => new Date(b.date) - new Date(a.date));

      res.render('user/orders', { user: req.session.user, cartCount, orders });
  }).catch((err) => {
      console.error(err);
      res.status(500).send("Internal Server Error");
  });
});

router.get('/view-order-products/:id',verifyLogin,async(req,res)=>{
  let products=await userHelpers.getOrderProducts(req.params.id)
res.render('user/view-order-products',{user:req.session.user,products})
})
router.post('/verify-payment',(req,res)=>{
  console.log(req.body);
  userHelpers.verifypayment(req.body).then(()=>{
    userHelpers.changePaymentStatus(req.body['order[receipt]']).then(()=>{
      console.log('payment succesful');
      res.json({status:true})
    })
  }).catch((err)=>{
    console.log(err);
    res.json({status:false,errMsg:''})
  })
})

router.get('/your-account',verifyLogin, async(req,res)=>{
  let user=req.session.user;

  res.render('user/your-account',{user})
})

router.get('/account-info', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let accountDetails = await userHelpers.userDetails(user);
  res.render('user/account-info', { user, accountDetails });
});

// New routes for updating account and verifying password


router.post('/update-account', verifyLogin, async (req, res) => {
  const userId = req.session.user._id;
  const { First_Name, Last_Name, Email } = req.body;

  try {
    await userHelpers.updateAccount(userId, { First_Name, Last_Name, Email });

    // Update the session data
    req.session.user.First_Name = First_Name;
    req.session.user.Last_Name = Last_Name;
    req.session.user.Email = Email;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.post('/verify-password', verifyLogin, async (req, res) => {
  const userId = req.session.user._id;
  const enteredPassword = req.body.password;
  
  try {
    const isValid = await userHelpers.verifyPassword(userId, enteredPassword);
    res.json({ success: isValid });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/delete-account', verifyLogin, async (req, res) => {
  const userId = req.session.user._id;

  try {
    await userHelpers.deleteAccount(userId);
    req.session.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/sell-products',verifyLogin, async(req,res)=>{
let user=req.session.user
res.render('user/sell-products',{user})

})

router.post('/add-product', (req, res) => {
  let product = {
      Name: req.body.Name,
      Category: req.body.Category,
      Price: req.body.Price,
      Description: req.body.Description,
  };

  productHelpers.addUserProduct(product).then((productId) => {
      if (req.files) {
          if (Array.isArray(req.files.Image)) {
              req.files.Image.forEach((image, index) => {
                  image.mv(`./public/product-images/${productId}_${index}.jpg`);
              });
          } else {
              req.files.Image.mv(`./public/product-images/${productId}.jpg`);
          }
      }
      res.redirect('/');
  });
});


router.get('/search-products', async (req, res) => {
  const query = req.query.query;

  try {
      const products = await productHelpers.searchProducts(query);
      res.json({ products });
  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
});




module.exports = router;
