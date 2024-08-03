var express = require('express');
var router = express.Router();
const path = require('path');
const fs = require('fs');
var objectId = require('mongodb').ObjectID
var productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helpers');

/* verify User login */
const verifyLogin = (req, res, next) => {
  if (req.session.userLoggedIn) {
    next();
  } else {
    req.session.returnTo = req.originalUrl; // Store the original URL
    res.redirect('/login');
  }
};


/* Route to home page. */
router.get('/', async function (req, res, next) {
  let user = req.session.user;
  let cartCount = 0;

  try {
    if (user) {
      cartCount = await userHelpers.getCartCount(user._id);
    } else {
      // If user is not logged in, calculate cart count from session storage
      if (req.session.cart) {
        cartCount = req.session.cart.length;
      }
    }
    
      let products = await productHelpers.getAllProducts();
      if(products.length === 0){
        res.render('user/empty/empty-shop', { user, cartCount });
        
      }else{
        res.render('product/view-products', { products, user, cartCount, search: true });
      }
     

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});


/* View each product. */
router.get('/view-product/:id', async (req, res) => {
  let user = req.session.user
  let Id = req.params.id
  let product = await productHelpers.getProductDetails(Id)
  let prodImages = await productHelpers.getProductImages(Id);
  let images = prodImages.images;
  let cartCount = 0;
  if (user) {
    cartCount = await userHelpers.getCartCount(user._id)
  }
  else {
    // If User is not logged in, calculate cart count from session storage
    if (req.session.cart) {
      cartCount = req.session.cart.length;
    }
  }
  
  res.render('product/view-product', { user, product, images, cartCount })
})


/* Route Signup page. */
router.get('/signup', (req, res) => {
  res.render('user/signup',{hide:true});
});


/* Save signup details and redirect to home page. */
router.post('/signup', (req, res) => {
  const { Password } = req.body;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,16}$/;

  if (!passwordRegex.test(Password)) {
    return res.render('user/signup', { error: 'Password must be 6-16 characters long, include at least one alphabetic letter, one numeric digit, and one special character.' });
  }

  userHelpers.doSignup(req.body).then((response) => {
    req.session.user = response;
    req.session.userLoggedIn = true;
    res.redirect('/');
  }).catch((err) => {
    res.render('user/signup', { error: 'Signup failed. Please try again.' });
  });
});


/* Login */
router.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('/')
  }
  else {
    res.render('user/login',{hide:true})
    req.session.userLoginErr = false
  }
})


/* return to recent URL after Login */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const response = await userHelpers.doLogin(req.body);

  if (response.status) {
    req.session.userLoggedIn = true;
    req.session.user = response.user;

    // Merge session cart with user's cart
    const sessionCart = req.session.cart || [];
 
    for (let productId of sessionCart) {
      let product = await productHelpers.getProductDetails(productId); 
      // Check if the product is still available
      if (product === null) { 
        continue; // Skip the rest of this iteration and continue with the next one
      } else {
        await userHelpers.addToCart(productId, response.user._id);
        //if the product was still available, add to Cart from Session Cart
      }
    }
    
    delete req.session.cart; // Clear session cart

    const returnTo = req.session.returnTo || '/'; // Default to home if no return URL
    delete req.session.returnTo; // Clear the return URL from session

    res.json({ success: true, redirectUrl: returnTo });
  } else {
    res.json({ success: false });
  }
});


/*For Logout  */
router.get('/logout', (req, res) => {
  req.session.user = null
  req.session.userLoggedIn = false
  res.redirect('/')
})


/*Get eASY Customer Service from Contact page*/
router.get('/contact', async (req, res) => {
  let cartCount = 0;
  let user = req.session.user;
  if (user) {
    cartCount = await userHelpers.getCartCount(user._id)
  }
  else {
    // If User is not logged in, calculate cart count from session storage
    if (req.session.cart) {
      cartCount = req.session.cart.length;
    }
  }

  res.render('user/contact', { cartCount, user })
})


/* Get message page */
router.get('/message', async (req, res) => {
  let cartCount = 0
  let user = req.session.user
  if (user) {
    cartCount = await userHelpers.getCartCount(user._id)
  }
  else {
    // If User is not logged in, calculate cart count from session storage
    if (req.session.cart) {
      cartCount = req.session.cart.length
    }
  }
  res.render('user/message', { cartCount,user,hide:true })
})


/*Post message from User */
router.post('/send-message',async(req,res)=>{
 await userHelpers.uploadMsg(req.body).then(() => {
    res.json({ send: true })
  }).catch((error)=>{
   console.log('message not send',error);
    res.status(500).send('Internal Server Error');
  })
})


/*Get Detail About eASY Shop */
router.get('/about', async (req, res) => {
  let cartCount = 0;
  let user = req.session.user;
  if (user) {
    cartCount = await userHelpers.getCartCount(user._id)
  }
  else {
    // If User is not logged in, calculate cart count from session storage
    if (req.session.cart) {
      cartCount = req.session.cart.length;
    }
  }

  res.render('user/about', { cartCount,user,hide:true })
})

/* GET Cart  */
router.get('/cart', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let products = await userHelpers.getCartProducts(req.session.user._id)
  let cartCount = await userHelpers.getCartCount(req.session.user._id)

  let totalValue = 0;
  if (products.length > 0) {
    totalValue = await userHelpers.getTotalAmount(req.session.user._id)
    res.render('user/cart', { products, user, totalValue, cartCount })
  } else {
    res.render('user/empty/empty-cart', { user, cartCount })
  }
})


/* Add to cart  */
router.get('/add-to-cart/:id', async (req, res) => {
  const productId = req.params.id;
  let userId = req.session.user ? req.session.user._id : null;
  let product = await productHelpers.getProductDetails(productId);

  try {

    if (product.Stock_Count > 0) {
      await productHelpers.changeStockCount(productId);

      if (userId) {
        await userHelpers.addToCart(productId, req.session.user._id);
        res.json({ status: true });
      } else {
        // Store cart items in session storage if user is not logged in
        if (!req.session.cart) {
          req.session.cart = [];
        }
        req.session.cart.push(productId);
        // Calculate cart count from session storage
        let cartCount = req.session.cart.length;
        res.json({ status: true, cartCount: cartCount });
      }
    } else {
      res.json({ status: false, message: 'Product out of stock' });
    }
  } catch (error) {
    console.error("Error during add-to-cart:", error);
    res.json({ status: false, message: 'An error occurred' });
  }
});


/* Delete cart products */
router.delete('/delete-cart-product/:id/:quantity', verifyLogin, async (req, res) => {
  const proId = req.params.id;
  const quantity = parseInt(req.params.quantity);
  const userId = req.session.user._id;

  userHelpers.deleteCartProduct(proId, quantity, userId).then(async (response) => {
    let total = await userHelpers.getTotalAmount(userId);
    let cartCount = await userHelpers.getCartCount(req.session.user._id);
    res.json({ success: true, cartCount: cartCount, total: total });
  }).catch((err) => {
    console.error('Error deleting product:', err);
    res.json({ success: false });
  });
});


/* Change product quantity in cart */
router.post('/change-product-quantity', async (req, res, next) => {

  userHelpers.changeProductQuantity(req.body).then(async (response) => {
    let total = await userHelpers.getTotalAmount(req.body.user);
    let cartCount = await userHelpers.getCartCount(req.session.user._id);

    if (response.removeProduct) {
      res.json({ removeProduct: true, cartCount: cartCount, total: total });
    } else if (response.outOfStock) {
      res.json({ outOfStock: true, cartCount: cartCount });
    } else {
      res.json({ status: true, cartCount: cartCount, total: total });
    }
  }).catch(err => {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while updating product quantity' });
  });
});


/* Buy single product*/
router.get('/buy-now/:id/:price', verifyLogin, async (req, res) => {
  try {
    let user = req.session.user;
    let prodId = req.params.id;
    let total = req.params.price;

    // Fetch cart count for the user
    let cartCount = await userHelpers.getCartCount(user._id);

    // Fetch product details
    let product = await productHelpers.getProductDetails(prodId);

    // Log product details for debugging purposes
    console.log("products", prodId, total, product);

    // Check if the product is out of stock
    if (product.Stock_Count < 1) {
      res.redirect('back');
    } else {
      // Reduce stock count and render the place-product page
      await productHelpers.reduceStockCount(prodId);
      res.render('user/place-product', { total, prodId, user, cartCount });
    }
  } catch (err) {
    // Log the error and redirect back
    console.error(err);
    res.redirect('back');
  }
});


/* Place single product */
router.post('/place-product', async (req, res) => {
  try {
    const userId = req.body.userId;
    const paymentMethod = req.body['payment-method'];

    const products = [{
      item: objectId(req.body.prodId),
      quantity: 1
    }];
    const total = req.body.total;

    // Place the order
    const orderId = await userHelpers.placeProduct(req.body, products, total);

    // Handle payment method
    if (paymentMethod === 'COD') {
      res.json({ codSuccess: true });
    } else {
      const response = await userHelpers.generateRazorpay(orderId, total);
      res.json(response);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong, please try again later.' });
  }
});


/* Route to Place orders page*/
router.get('/place-order', verifyLogin, async (req, res) => {
  let total = await userHelpers.getTotalAmount(req.session.user._id);
  let user = req.session.user;
  let cartCount = await userHelpers.getCartCount(req.session.user._id);

  res.render('user/place-order', { total, user, cartCount })
})


/* Place orders */
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
      await productHelpers.removeCartProducts(userId).then(() => {
        res.json({ codSuccess: true });
      })

    } else {
      const response = await userHelpers.generateRazorpay(orderId, totalPrice);
      res.json(response);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong, please try again later.' });
  }
});


/* order success page*/
router.get('/order-success', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let cartCount = await userHelpers.getCartCount(user._id);

  res.render('user/order-success', { user, cartCount });
});


/* Orders*/
router.get('/orders', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let cartCount = await userHelpers.getCartCount(user._id);

  userHelpers.getAllUserOrders(user._id).then((orders) => {
    // Sort orders by date in descending order
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (orders.length === 0) {
      res.render('user/empty/no-orders', { user, cartCount });
    } else {
      res.render('user/orders', { user, cartCount, orders });
    }
  }).catch((err) => {
    console.error(err);
    res.status(500).send("Internal Server Error");
  });
});


/* Verify payment for orders(for all cart products) */
router.post('/verify-payments', (req, res) => {
  let userId = req.session.user._id
  userHelpers.verifypayment(req.body, userId).then(() => {
    userHelpers.changePaymentStatus(req.body['order[receipt]']).then(async () => {
      await productHelpers.removeCartProducts(userId).then(() => {
        console.log('payment succesful');
        res.json({ status: true })
      })
    })
  }).catch((err) => {
    console.log(err);
    res.json({ status: false, errMsg: '' })
  })
})


/* Verify payment for single product order(by Buy Now) */
router.post('/verify-payment', (req, res) => {
  console.log(req.body);
  let userId = req.session.user._id;
  userHelpers.verifypayment(req.body, userId).then(() => {
    userHelpers.changePaymentStatus(req.body['order[receipt]']).then(() => {
      console.log('payment successful');
      res.json({ status: true });
    });
  }).catch((err) => {
    console.log(err);
    res.json({ status: false, errMsg: '' });
  });
});


/* Your Account*/
router.get('/your-account', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let cartCount = await userHelpers.getCartCount(req.session.user._id)
  res.render('user/your-account', { user, cartCount })
})


/* Account Settings */
router.get('/account-settings', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let accountDetails = await userHelpers.userDetails(user);
  let cartCount = await userHelpers.getCartCount(user._id)
  res.render('user/account-settings', { user, accountDetails, cartCount });
});


/* For updating account and verifying password */
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


/*verifying password */
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


/*Delete Account*/
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


/*Get User selling products*/
router.get('/your-products', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let cartCount = await userHelpers.getCartCount(user._id);
  try {
    //User selling Products details
    let products = await userHelpers.getUserRequestProds(user._id);
    
    res.render('user/your-products', { user, products, cartCount });
  } catch (error) {
    res.render('user/empty/no-products', { error, user, cartCount });
  }
});


/*Delete User approved selling product */
router.delete('/delete-user-product/:id', verifyLogin, (req, res) => {
  let proId = req.params.id;
  productHelpers.deleteUserProduct(proId).then((response) => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error deleting user product:', err);
    res.json({ success: false });
  });
});


/*Delete User requested selling product */
router.delete('/delete-user-pendingprod/:id', verifyLogin, (req, res) => {
  let proId = req.params.id;
  productHelpers.deletePendingProduct(proId).then((response) => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error deleting user pending product:', err);
    res.json({ success: false });
  });
});


/* Route to render the Edit User's selling product page */
router.get('/edit-user-product/:id', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let prodId = req.params.id;
  let cartCount = await userHelpers.getCartCount(user._id);
  try {
    let product = await productHelpers.getProductDetails(prodId);
    console.log("Product details:", product);
    res.render('user/edit-user-product', { product, user, cartCount });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


/* Route to handle the Product Update and redirect to Edit product images */
router.post('/edit-user-product/:id', verifyLogin, (req, res) => {
  let id = req.params.id;
  productHelpers.updateUserProduct(req.params.id, req.body)
  res.redirect(`/user-product-images/${id}`);
});


/* Route to render the user-product-images page for editing */
router.get('/user-product-images/:id', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let cartCount = await userHelpers.getCartCount(user._id)
  try {
    let product = await productHelpers.getProductImages(req.params.id);
    res.render('user/user-product-images', { product, user, cartCount });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


/* Route to handle the image upload and skip actions after edit product images*/
router.post('/user-product-images/:id', verifyLogin, async (req, res) => {
  let productId = req.params.id;
  let uploadPromises = [];

  if (req.body.skip) {
    return res.redirect('/your-account');
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
      res.redirect('/your-account');
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send(err);
    });
});


/* Route for deleting product images from user-product-images*/
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


/* Route for post edited user product images  */
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


/* Route for editing pending product */
router.get('/edit-pending-product/:id', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let prodId = req.params.id;
  let cartCount = await userHelpers.getCartCount(user._id);
  try {
    let product = await productHelpers.getProductDetails(prodId);
    console.log("Pending product details:", product);
    res.render('user/edit-pending-product', { product, user, cartCount });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


/* Post edited images for pending products  */
router.post('/edit-pending-product/:id', verifyLogin, (req, res) => {
  let id = req.params.id;
  productHelpers.updateUserProduct(req.params.id, req.body)
  console.log('pending product updated');
  res.redirect(`/pending-product-images/${id}`);
});


/* Route to pending-product-images for selling product (not approved products)*/
router.get('/pending-product-images/:id', verifyLogin, async (req, res) => {
  let user = req.session.user;
  let cartCount = await userHelpers.getCartCount(user._id)
  try {
    let product = await productHelpers.getPndgProductImages(req.params.id);
    res.render('user/pending-product-images', { product, user, cartCount });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


/* Route to handle the image upload and skip actions */
router.post('/pending-product-images/:id', async (req, res) => {
  let productId = req.params.id;
  let uploadPromises = [];

  if (req.body.skip) {
    return res.redirect('/your-account');
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
      res.redirect('/your-account');
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send(err);
    });
});


/* Route for deleting pending product images */
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


/* Route for get Sell User Products form page */
router.get('/sell-products', verifyLogin, async (req, res) => {
  try {
    let user = req.session.user;
    let cartCount = await userHelpers.getCartCount(user._id);
    res.render('user/sell-products', { user, cartCount });
  } catch (error) {
    console.error('Error fetching cart count:', error);
    res.status(500).send('Internal Server Error');
  }
});


/* Sell user products */
router.post('/sell-product', (req, res) => {
  let product = req.body
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
    res.redirect('/your-account');
  });
});


/* Search products in home page */
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
