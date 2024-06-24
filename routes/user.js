var express = require('express');
var router = express.Router();
const path = require('path');
const fs = require('fs');
var objectId = require('mongodb').ObjectID
var productHelpers=require('../helpers/product-helpers');
const bcrypt=require('bcrypt')
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

router.get('/view-product/:id',async(req,res)=>{
  let user=req.session.user
  let Id=req.params.id
 let product= await productHelpers.getProductDetails(Id)
 let prodImages = await productHelpers.getProductImages(Id);
 let images=prodImages.images;
 let cartCount=null;
 if(user) {
  cartCount=await userHelpers.getCartCount(user._id)
  }
 console.log("producto",images);
res.render('product/view-product',{user,product,images,cartCount})
})


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

 

  router.get('/signup', (req, res) => {
      res.render('user/signup');
  });
  
  router.post('/signup', (req, res) => {
      const { Password } = req.body;
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,16}$/;
  
      if (!passwordRegex.test(Password)) {
          return res.render('user/signup', { error: 'Password must be 6-16 characters long, include at least one alphabetic letter, one numeric digit, and one special character.' });
      }
  
      userHelpers.doSignup(req.body).then((response) => {
          console.log(response);
  
          req.session.user = response;
          req.session.userLoggedIn = true;
          res.redirect('/');
      }).catch((err) => {
          res.render('user/signup', { error: 'Signup failed. Please try again.' });
      });
  });
  
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
 
    userHelpers.addToCart(req.params.id,req.session.user._id).then(()=>{
   
      res.json({status:true})
       })
  
})

router.delete('/delete-cart-product/:id', verifyLogin, (req, res) => {
  let proId = req.params.id;
  let userId=req.session.user._id
  userHelpers.deleteCartProduct(proId,userId).then((response) => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error deleting product:', err);
    res.json({ success: false });
  });
});


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

router.get('/buy-now/:id/:price',verifyLogin,async(req,res)=>{
  let user=req.session.user;
  let prodId= req.params.id;
  let total= req.params.price
  console.log("producters",prodId,total);
  res.render('user/place-product',{total,prodId,user})
})

router.post('/place-product', async (req, res) => {
  try {
    const userId = req.body.userId;
    const paymentMethod = req.body['payment-method'];

    // Get cart products and total price
    const products= [{item: objectId(req.body.prodId),
                      quantity:1}]
    const total = req.body.total;

    // Place the order
    const orderId = await userHelpers.placeProduct(req.body, products, total);

    // Handle payment method
    if (paymentMethod === 'COD') {
      res.json({ codSuccess: true });
    } else {
      const response = await userHelpers.generateRazorpay(orderId, price);
      res.json(response);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong, please try again later.' });
  }
});



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
      console.log("gggg",orders);
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
  
  let { First_Name, Last_Name, Email, Phone, Gender, Password } = req.body;


  try {
    await userHelpers.updateAccount(userId, { First_Name, Last_Name, Email, Phone, Gender, Password });

    // Update the session data
    req.session.user.First_Name = First_Name;
    req.session.user.Last_Name = Last_Name;
    req.session.user.Email = Email;
    req.session.user.Phone = Phone;
    req.session.user.Gender = Gender;
    

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

router.get('/your-products',verifyLogin,async(req,res)=>{
  let user=req.session.user
  await userHelpers.getUserRequestProds(user._id).then((productsWoQnty) => {

    productHelpers.getCartedProductQuantity().then((productQuantity) => {

      productHelpers.getAllProductswithQuantity(productsWoQnty, productQuantity).then((products) => {

        console.log("userprods",products);
        res.render('user/your-products',{user,products})

      })
    })

}).catch((error) => {
   res.render('user/no-products',{error,user})
});

})



router.delete('/delete-user-product/:id', verifyLogin, (req, res) => {
  let proId = req.params.id;
  productHelpers.deleteUserProduct(proId).then((response) => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error deleting user product:', err);
    res.json({ success: false });
  });
});

router.delete('/delete-user-pendingprod/:id', verifyLogin, (req, res) => {
  let proId = req.params.id;
  productHelpers.deletePendingProduct(proId).then((response) => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error deleting user pending product:', err);
    res.json({ success: false });
  });
});
// Route to render the edit user product page
router.get('/edit-user-product/:id', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let prodId = req.params.id;
 

  try {
    let product = await productHelpers.getProductDetails(prodId);
  
    console.log("Product details:", product);
    res.render('user/edit-user-product', { product, user });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


// Route to handle the product update
router.post('/edit-user-product/:id', verifyLogin, (req, res) => {
  let id = req.params.id;
  
   productHelpers.updateUserProduct(req.params.id, req.body)
   
      res.redirect(`/add-more-images/${id}`);
    
});

// Route to render the add more images page


router.get('/add-more-images/:id', verifyLogin, async (req, res) => {
  let user = req.session.user;
  try {
    let product = await productHelpers.getProductImages(req.params.id);
    res.render('user/add-more-images', { product, user});
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

// Route to handle the image upload and skip actions
router.post('/add-more-images/:id', async (req, res) => {
  let productId = req.params.id;
  let uploadPromises = [];

  if (req.body.skip) {
     return res.redirect('/');
  }

  if (req.files && req.files.Images) {
     let images = req.files.Images;
     if (!Array.isArray(images)) {
        images = [images];
     }

     let product = await productHelpers.getProductImages(productId);
     let productLength = product.images.length;

     images.forEach((image, index) => {
        uploadPromises.push(new Promise((resolve, reject) => {
           let newIndex = productLength + index;
           let filePath = path.join(__dirname, '../public/product-images', `${productId}_${newIndex}.jpg`);

           image.mv(filePath, (err) => {
              if (err) {
                 return reject(err);
              }
              resolve();
           });
        }));
     });
  }

  Promise.all(uploadPromises)
     .then(async () => {
        const imageDir = path.join(__dirname, '../public/product-images');
        let imageFiles = fs.readdirSync(imageDir).filter(file => file.startsWith(productId)).sort();
        imageFiles = imageFiles.map((file, index) => {
           const newFileName = `${productId}_${index}.jpg`;
           fs.renameSync(path.join(imageDir, file), path.join(imageDir, newFileName));
           return newFileName;
        });
        await productHelpers.updateProductImages(productId, imageFiles);
        res.redirect('/');
     })
     .catch((err) => {
        console.error(err);
        res.status(500).send(err);
     });
});


// Route for deleting images
router.delete('/delete-image', verifyLogin, async (req, res) => {
  const { imageName, productId } = req.body;
  const filePath = path.join(__dirname, '../public/product-images', imageName);

  fs.unlink(filePath, async (err) => {
     if (err) {
        console.error(err);
        return res.status(500).send(err);
     }

     try {
        const imageDir = path.join(__dirname, '../public/product-images');
        let imageFiles = fs.readdirSync(imageDir).filter(file => file.startsWith(productId)).sort();
        imageFiles = imageFiles.map((file, index) => {
           const newFileName = `${productId}_${index}.jpg`;
           fs.renameSync(path.join(imageDir, file), path.join(imageDir, newFileName));
           return newFileName;
        });
        await productHelpers.updateProductImages(productId, imageFiles);
        res.sendStatus(200);
     } catch (error) {
        console.error('Error renumbering images:', error);
        res.status(500).send(error);
     }
  });
});


// Route for editing images (for pending images too)
router.post('/edit-image', verifyLogin, async (req, res) => {
  if (!req.files || !req.files.newImage) {
     return res.status(400).send('No new image file uploaded.');
  }

  const newImage = req.files.newImage;
  const { oldImageName, productId } = req.body;

  const oldImagePath = path.join(__dirname, '../public/product-images', oldImageName);

  newImage.mv(oldImagePath, (err) => {
     if (err) {
        console.error(err);
        return res.status(500).send(err);
     }
     res.sendStatus(200);
  });
});


router.get('/edit-pending-product/:id', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let prodId = req.params.id;
 

  try {
    let product = await productHelpers.getProductDetails(prodId);
  
    console.log("Pending product details:", product);
    res.render('user/edit-pending-product', { product, user });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

router.post('/edit-pending-product/:id', verifyLogin, (req, res) => {
  let id = req.params.id;
  
   productHelpers.updateUserProduct(req.params.id, req.body)
   console.log('pending product updated');
    
   res.redirect(`/add-morepending-images/${id}`);
    
});


// Route to render the add morepending images page


router.get('/add-morepending-images/:id', verifyLogin, async (req, res) => {
  let user = req.session.user;
  try {
    let product = await productHelpers.getPndgProductImages(req.params.id);
    res.render('user/add-morepending-images', { product, user});
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


// Route to handle the image upload and skip actions
router.post('/add-morepending-images/:id', async (req, res) => {
  let productId = req.params.id;
  let uploadPromises = [];

  if (req.body.skip) {
     return res.redirect('/');
  }

  if (req.files && req.files.Images) {
     let images = req.files.Images;
     if (!Array.isArray(images)) {
        images = [images];
     }

     let product = await productHelpers.getPndgProductImages(productId);
     let productLength = product.images.length;

     images.forEach((image, index) => {
        uploadPromises.push(new Promise((resolve, reject) => {
           let newIndex = productLength + index;
           let filePath = path.join(__dirname, '../public/product-images', `${productId}_${newIndex}.jpg`);

           image.mv(filePath, (err) => {
              if (err) {
                 return reject(err);
              }
              resolve();
           });
        }));
     });
  }

  Promise.all(uploadPromises)
     .then(async () => {
        const imageDir = path.join(__dirname, '../public/product-images');
        let imageFiles = fs.readdirSync(imageDir).filter(file => file.startsWith(productId)).sort();
        imageFiles = imageFiles.map((file, index) => {
           const newFileName = `${productId}_${index}.jpg`;
           fs.renameSync(path.join(imageDir, file), path.join(imageDir, newFileName));
           return newFileName;
        });
        await productHelpers.updatePndgProductImages(productId, imageFiles);
        res.redirect('/');
     })
     .catch((err) => {
        console.error(err);
        res.status(500).send(err);
     });
});


// Route for deleting pending product images
router.delete('/delete-pending-image', verifyLogin, async (req, res) => {
  const { imageName, productId } = req.body;
  const filePath = path.join(__dirname, '../public/product-images', imageName);

  fs.unlink(filePath, async (err) => {
     if (err) {
        console.error(err);
        return res.status(500).send(err);
     }

     try {
        const imageDir = path.join(__dirname, '../public/product-images');
        let imageFiles = fs.readdirSync(imageDir).filter(file => file.startsWith(productId)).sort();
        imageFiles = imageFiles.map((file, index) => {
           const newFileName = `${productId}_${index}.jpg`;
           fs.renameSync(path.join(imageDir, file), path.join(imageDir, newFileName));
           return newFileName;
        });
        await productHelpers.updatePndgProductImages(productId, imageFiles);
        res.sendStatus(200);
     } catch (error) {
        console.error('Error renumbering images:', error);
        res.status(500).send(error);
     }
  });
});



router.get('/sell-products',verifyLogin, async(req,res)=>{
let user=req.session.user
res.render('user/sell-products',{user})

})

router.post('/sell-product', (req, res) => {
  let product=req.body
  
  productHelpers.addUserProduct(product).then((productId) => {
      if (req.files) {
          if (Array.isArray(req.files.Image)) {
              req.files.Image.forEach((image, index) => {
                  image.mv(`./public/product-images/${productId}_${index}.jpg`);
              });
          } else {
              req.files.Image.mv(`./public/product-images/${productId}_0.jpg`);
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
