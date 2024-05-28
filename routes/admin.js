var express = require('express');
var router = express.Router();
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
router.get('/', verifyLogin, function (req, res, next) {
  productHelpers.getAllProducts().then((products) => {
    console.log(products)
    res.render('admin/view-products', { admin: true, products })
  })
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

router.get('/delete-user/:id', verifyLogin, (req, res) => {
  let userId = req.params.id
  adminHelpers.deleteUser(userId).then((response) => {
    res.redirect('/admin/all-users')
  })
})

router.get('/all-orders', verifyLogin, (req, res) => {
  adminHelpers.getAllOrders().then((orders) => {
    res.render('admin/all-orders', { admin: true, orders })
  })
})

router.get('/add-product', verifyLogin, function (req, res) {
  res.render('admin/add-product', { admin: true })
})

router.post('/add-product', (req, res) => {
  productHelpers.addProduct(req.body, (id) => {
    let image = req.files.Image
    console.log(id)
    image.mv('./public/product-images/' + id + '.jpg', (err) => {
      if (!err) {
        res.render("admin/add-product", { admin: true })
      } else {
        consoele.log(err)
      }
    })
  })
})

router.get('/delete-product/:id', verifyLogin, (req, res) => {
  let proId = req.params.id
  console.log(proId);
  productHelpers.deleteProduct(proId).then((response) => {
    res.redirect('/admin/')
  })
})

router.get('/edit-product/:id', verifyLogin, async (req, res) => {
  let product = await productHelpers.getProductDetails(req.params.id)
  console.log(product);
  res.render('admin/edit-product', { product, admin: true })
})

router.post('/edit-product/:id', (req, res) => {
  let id = req.params.id
  productHelpers.updateProduct(req.params.id, req.body).then(() => {
    res.redirect('/admin')
    if (req.files.Image) {
      let image = req.files.Image
      image.mv('./public/product-images/' + id + '.jpg')
    }
  })
})

router.post('/update-order-status', (req, res) => {
  let { orderId, status } = req.body;
  adminHelpers.updateOrderStatus(orderId, status).then(() => {
    res.json({ success: true });
  }).catch((err) => {
    console.error('Error updating order status:', err);
    res.json({ success: false });
  });
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
