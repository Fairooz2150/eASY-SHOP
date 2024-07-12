var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const adminHelpers = require('../helpers/admin-helpers');
const productHelpers = require('../helpers/product-helpers');
const { log } = require('console');
const verifyLogin = (req, res, next) => {
  if (req.session.adminLoggedIn) {
    next()
  } else {
    res.redirect('/admin/login')
  }
}

/* GET users listing. */
router.get('/', verifyLogin, async (req, res, next) => {
  try {
    const productsWoQnty = await productHelpers.getAllProducts();
    const productQuantity = await productHelpers.getCartedProductQuantity();
    let stockCount = await productHelpers.getAllProducts();

    const products = await productHelpers.getAllProductswithQuantity(productsWoQnty,stockCount, productQuantity);

    console.log(products);
    res.render('admin/view-products', { admin: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.render('admin/view-products', { admin: true, error: 'Failed to fetch products' });
  }
});

router.get('/login', (req, res) => {
  if (req.session.admin) {
    res.redirect('/admin/')
  } else {
    res.render('admin/login', { admin: true, "loginErr": req.session.adminLoginErr, userOption: true })
    req.session.adminLoginErr = false
  }
})

router.post('/login', (req, res) => {
  adminHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.admin = response.admin
      req.session.adminLoggedIn = true
      res.redirect('/admin/')
    } else {
      req.session.adminLoginErr = "Invalid Username or Password"
      res.redirect('/admin/login')
    }
  })
})

router.get('/logout', (req, res) => {
  req.session.admin = null
  req.session.adminLoggedIn = false
  res.redirect('/admin/login')
})

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


router.delete('/delete-product/:id', verifyLogin, (req, res) => {
  let proId = req.params.id;
  productHelpers.deleteProduct(proId).then((response) => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error deleting product:', err);
    res.json({ success: false });
  });
});


router.get('/all-orders', verifyLogin, (req, res) => {
  adminHelpers.getAllOrders().then((orders) => {
    res.render('admin/all-orders', { admin: true, orders })
  })
})

router.get('/add-product', verifyLogin, function (req, res) {
  res.render('admin/add-product', { admin: true })
})



router.post('/add-product', (req, res) => {
  let product = {
    Name: req.body.Name,
    Category: req.body.Category,
    Actual_Price: req.body.Actual_Price,
    Offer_Price: req.body.Offer_Price,
    Offer_Percentage: req.body.Offer_Percentage,
    Description: req.body.Description,
    Product_Owner: req.body.Product_Owner,
    Carted: req.body.Carted,
    Stock_Count:req.body.Stock_Count
  };
  

  productHelpers.addProduct(product).then((productId) => {
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




router.get('/edit-product/:id', verifyLogin, async (req, res) => {
  try {
    let product = await productHelpers.getProductDetails(req.params.id);
    res.render('admin/edit-product', { product, admin: true });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


router.post('/edit-product/:id', (req, res) => {
  let id = req.params.id;
  productHelpers.updateProduct(req.params.id, req.body).then(() => {

    res.redirect(`/admin/add-more-images/${id}`);

  }).catch((err) => {
    console.error(err);
    res.status(500).send(err);
  });
});

// Route to render the add more images page
router.get('/add-more-images/:id', verifyLogin, async (req, res) => {
  try {
    let product = await productHelpers.getProductImages(req.params.id);
    res.render('admin/addMoreImages', { product, admin: true });
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





// Route for deleting images
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

// Route for editing images
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


router.post('/update-order-status', (req, res) => {
  let { orderId, status } = req.body;
  adminHelpers.updateOrderStatus(orderId, status).then(() => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error updating order status:', err);
    res.json({ success: false });
  });
});

router.post('/update-user-products-status', (req, res) => {
  let { Id, Status } = req.body;
  adminHelpers.updateUserProdStatus(Id, Status).then(() => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error updating user products status:', err);
    res.json({ success: false });
  });
});



router.get('/product-requests', verifyLogin, async (req, res) => {
  try {
    let products = await productHelpers.getAllUserProducts();
    res.render('admin/product-requests', { admin: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Server error');
  }
});

router.post('/sort-orders', verifyLogin, async (req, res) => {
  try {
    const { order } = req.body;

    let sortedOrders;
    if (order === 'asc') {
      sortedOrders = await adminHelpers.getAllOrdersAscending();
    } else if (order === 'desc') {
      sortedOrders = await adminHelpers.getAllOrdersDescending();
    } else {
      return res.status(400).json({ success: false, message: 'Invalid sorting order' });
    }

    res.json({ success: true, orders: sortedOrders });
  } catch (error) {
    console.error('Error sorting orders:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});




module.exports = router;
