var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const adminHelpers = require('../helpers/admin-helpers');
const productHelpers = require('../helpers/product-helpers');
const { log } = require('console');

/* verify Admin login */
const verifyLogin = (req, res, next) => { 
  if (req.session.adminLoggedIn) {
    next()
  } else {
    req.session.returnTo = req.originalUrl; // Store the original URL
    res.redirect('/admin/login')
  }
}


/* GET Admin Home page, get all products */
router.get('/', verifyLogin, async (req, res, next) => {
  try {

    await productHelpers.getAllProducts().then((products) => {
      res.render('admin/view-products', { admin: true, products });
    }).catch((err) => {
      console.error('Error fetching products:', err);
      res.render('admin/empty/empty-shop', { admin: true });
    })

  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


/* GET Login page */
router.get('/login', (req, res) => {
  if (req.session.admin) {
    res.redirect('/admin/')
  } else {
    res.render('admin/login', { admin: true, loginPage: true })
    req.session.adminLoginErr = false
  }
})


/* return to recent URL after Login */
router.post('/login', async (req, res) => {

  await adminHelpers.doLogin(req.body).then((response) => {

    if (response.status) {
      req.session.adminLoggedIn = true;
      req.session.admin = response.admin;

      const returnTo = req.session.returnTo || '/admin/'; // Default to home if no return URL
      delete req.session.returnTo; // Clear the return URL from session

      res.json({ success: true, redirectUrl: returnTo });
    } else {
      res.json({ success: false });
    }
  })
});


/* For Logout */
router.get('/logout', (req, res) => {
  req.session.admin = null
  req.session.adminLoggedIn = false
  res.redirect('/admin/login')
})


/* GET all Users Product Requests for selling */
router.get('/product-requests', verifyLogin, async (req, res) => {
  try {
    let products = await productHelpers.getAllUserProducts();
    products.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.render('admin/product-requests', { admin: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Server error');
  }
})


/* Update User Products Status */
router.post('/update-user-products-status', (req, res) => {
  let { Id, Status } = req.body;
  adminHelpers.updateUserProdStatus(Id, Status).then(() => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error updating user products status:', err);
    res.json({ success: false });
  });
})


/* GET All Users orders */
router.get('/all-orders', verifyLogin, (req, res) => {
  adminHelpers.getAllOrders().then((orders) => {
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.render('admin/all-orders', { admin: true, orders })
  })
})


/* Update User Order Status */
router.post('/update-order-status', (req, res) => {
  let { orderId, status } = req.body;
  adminHelpers.updateOrderStatus(orderId, status).then(() => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error updating order status:', err);
    res.json({ success: false });
  });
});


router.get('/all-users', verifyLogin, (req, res) => {
  adminHelpers.getAllUsers().then((users) => {
    res.render('admin/all-users', { admin: true, users: users });
  }).catch((error) => {
    console.error("Error fetching users:", error);
    res.status(500).send("Error fetching users");
  });
});

router.delete('/delete-user/:id', verifyLogin, (req, res) => {
  let userId = req.params.id
  adminHelpers.deleteUser(userId).then((response) => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error deleting user:', err);
    res.json({ success: false });
  });
})


/*GET Add Product page*/
router.get('/add-product', verifyLogin, (req, res)=> {
  res.render('admin/add-product', { admin: true })
})


/*POST product details for adding new product*/
router.post('/add-product', verifyLogin, (req, res) => {
  productHelpers.addProduct(req.body).then((productId) => {
    if (req.files) {
      if (Array.isArray(req.files.Image)) {
        req.files.Image.forEach((image, index) => {
          image.mv(`./public/product-images/${productId}_${index}.jpg`);
        });
      } else {
        req.files.Image.mv(`./public/product-images/${productId}_0.jpg`);
      }
    }
    res.redirect('/admin/')
  });
});


/* Delete product */
router.delete('/delete-product/:id', verifyLogin, async (req, res) => {
  try {
    let proId = req.params.id;
    let response = await productHelpers.deleteProduct(proId);
    res.json({ success: true, response });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
})


/* Route to handle the product update and redirect to edit product images */
router.get('/edit-product/:id', verifyLogin, async (req, res) => {
  try {
    let product = await productHelpers.getProductDetails(req.params.id);
    res.render('admin/edit-product', { product, admin: true });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


/* Route to handle the Product Update and redirect to Edit product images */
router.post('/edit-product/:id', (req, res) => {
  let id = req.params.id;
  productHelpers.updateProduct(req.params.id, req.body).then(() => {
    res.redirect(`/admin/edit-images/${id}`);
  }).catch((err) => {
    console.error(err);
    res.status(500).send(err);
  });
});


// GET the Edit images page
router.get('/edit-images/:id', verifyLogin, async (req, res) => {
  try {
    let product = await productHelpers.getProductImages(req.params.id);
    res.render('admin/edit-images', { product, admin: true });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


// Route to handle the image upload and skip actions
router.post('/edit-images/:id', async (req, res) => {
  let productId = req.params.id;
  let uploadPromises = [];

  if (req.body.skip) {
    return res.redirect('/admin/');
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
      res.redirect('/admin/');
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send(err);
    });
});


// Route for Deleting images from Edit Images page
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


// Route for upload Changed Images in the Edit images page
router.post('/edit-image', verifyLogin, (req, res) => {
  if (!req.files || !req.files.newImage) {
    return res.status(400).send('No new image file uploaded.');
  }

  const newImage = req.files.newImage;
  const { oldImageName, productId } = req.body;

  const oldImagePath = path.join(__dirname, '../public/product-images', oldImageName);
  const newImagePath = path.join(__dirname, '../public/product-images', oldImageName); // Overwrite the old image

  newImage.mv(newImagePath, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send(err);
    }

    res.sendStatus(200);
  });
});



module.exports = router;
