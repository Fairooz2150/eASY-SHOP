var db = require('../config/connection')
var collection = require('../config/collections')
const bcrypt = require('bcrypt')
var objectId = require('mongodb').ObjectID
const moment = require('moment');
const Razorpay = require("razorpay");
var instance = new Razorpay({
    key_id: 'rzp_test_Eiq5plL9zWA6bb',
    key_secret: 'NxHqrxegFsANJL3mBznh2YvY',
});
module.exports = {
    doSignup: (userData) => {
        return new Promise(async (resolve, reject) => {
            userData.Password = await bcrypt.hash(userData.Password, 10)
            db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((data) => {
                resolve(data.ops[0])
            })

        })
    },
    doLogin: (userData) => {
        return new Promise(async (resolve, reject) => {
            let loginStatus = false
            let response = {}
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ Email: userData.Email })
            if (user) {
                bcrypt.compare(userData.Password, user.Password).then((status) => {
                    if (status) {
                        console.log('Login Succsess')
                        response.user = user
                        response.status = true
                        resolve(response)
                    } else {
                        console.log('Wrong password entered')
                        resolve({ status: false })
                    }
                })
            } else {
                console.log('No user in this email id')
                resolve({ status: false })
            }
        })
    },
    addToCart: (proId, userId) => {
        let proObj = {
            item: objectId(proId),
            quantity: 1
        }
        return new Promise(async (resolve, reject) => {
            let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: objectId(userId) })
            if (userCart) {
                let proExist = userCart.products.findIndex(product => product.item == proId)
                console.log(proExist);
                if (proExist != -1) {
                    db.get().collection(collection.CART_COLLECTION).
                        updateOne({ user: objectId(userId), 'products.item': objectId(proId) },
                            {
                                $inc: { 'products.$.quantity': 1 }
                            }
                        ).then(() => {
                            resolve()
                        })
                }
                else {
                    db.get().collection(collection.CART_COLLECTION).
                        updateOne({ user: objectId(userId) },
                            {

                                $push: { products: proObj }

                            }
                        ).then((response) => {

                            resolve()
                        })
                }

            } else {
                let cartObj = {
                    user: objectId(userId),
                    products: [proObj]
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve()
                })
            }
        })


    },
    getCartProducts: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: objectId(userId) }
                },
                {
                    $unwind: '$products'
                }, {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                }, {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                }, {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                }

            ]).toArray();

            resolve(cartItems);
        })
    },
    getUserRequestProds: (userId) => {
        return new Promise(async (resolve, reject) => {
          let products = await db.get().collection(collection.USER_PRODUCTS_COLLECTION).find({ Seller_Id: objectId(userId) }).toArray();
          if (products.length > 0) {
            resolve(products);
          } else {
            reject("You have no products");
          }
        });
      },
    getCartCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            try {
                let totalQuantity = 0;
                let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: objectId(userId) });
                if (cart) {
                    // Iterate over each product in the cart and sum up their quantities
                    cart.products.forEach(product => {
                        totalQuantity += parseInt(product.quantity) || 0; // Ensure quantity is a valid number
                    });
                }
                resolve(totalQuantity);
            } catch (error) {
                reject(error);
            }
        });
    },
    changeProductQuantity: (details) => {
        details.count = parseInt(details.count);
        details.quantity = parseInt(details.quantity);
    
        return new Promise(async (resolve, reject) => {
            try {
                let product = await db.get().collection(collection.PRODUCT_COLLECTION)
                    .findOne({ _id: objectId(details.product) });
    
                // Check if the product has sufficient stock
                if (product.Stock_Count <= 0 && details.count === 1) {
                    resolve({ outOfStock: true });
                } else {
                    // Update cart quantity
                        if(details.quantity===1&& details.count === -1){
                            await db.get().collection(collection.CART_COLLECTION).updateOne({ _id: objectId(details.cart) }, { $pull: { products: { item: objectId(details.product) } } })
                            await db.get().collection(collection.PRODUCT_COLLECTION)
                            .updateOne({ _id: objectId(details.product) },
                                { $inc: { Stock_Count: -details.count } });
                                resolve({ removeProduct: true });
                        
                        }else{
                            await db.get().collection(collection.CART_COLLECTION)
                        .updateOne({ _id: objectId(details.cart), 'products.item': objectId(details.product) },
                            { $inc: { 'products.$.quantity': details.count } });
    
                    // Decrease product stock count
                    await db.get().collection(collection.PRODUCT_COLLECTION)
                        .updateOne({ _id: objectId(details.product) },
                            { $inc: { Stock_Count: -details.count } });
    
                    resolve({ status: true });
                        }
                    
                }
            } catch (error) {
                reject(error);
            }
        });
    },    
      
   
    deleteCartProduct: (prodId, quantity, userId) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.CART_COLLECTION).updateOne({ user: objectId(userId) }, { $pull: { products: { item: objectId(prodId) } } }).then((response) => {
                db.get().collection(collection.PRODUCT_COLLECTION).findOneAndUpdate({ _id: objectId(prodId) },
                    [{ $set: { Stock_Count: { $add: [{ $toInt: "$Stock_Count" }, parseInt(quantity)] } } }])
    
                resolve(response);
            }).catch((err) => {
                reject(err);
            });
        });
    },
    

    getTotalAmount: (userId) => {
        return new Promise(async (resolve, reject) => {
            try {
                let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
                    {
                        $match: { user: objectId(userId) }
                    },
                    {
                        $unwind: '$products'
                    }, {
                        $project: {
                            item: '$products.item',
                            quantity: '$products.quantity'
                        }
                    }, {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField: '_id',
                            as: 'product'
                        }
                    }, {
                        $project: {
                            item: 1,
                            quantity: 1,
                            product: { $arrayElemAt: ['$product', 0] }
                        }
                    }, {
                        $group: {
                            _id: null,
                            total: {
                                $sum: {
                                    $multiply: [
                                        '$quantity',
                                        {
                                            $convert: {
                                                input: '$product.Offer_Price',
                                                to: 'int',
                                                onError: 0, // Provide a default value in case of conversion error
                                                onNull: 0   // Provide a default value in case of null
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ]).toArray();

                if (total.length > 0 && total[0].total !== undefined) {
                    resolve(total[0].total);
                } else {
                    resolve(0); // Return 0 if total is undefined or empty
                }
            } catch (error) {
                reject(error);
            }
        });
    },
    placeOrder: (order, products, total) => {
        return new Promise((resolve, reject) => {
            console.log(order, products, total);
            let status = order['payment-method'] === 'COD' ? 'placed' : 'pending';
            let orderDate = moment().format('DD MMM YYYY');
            let orderTime = moment().format('hh:mmA');

            let orderObj = {
                deliveryDetails: {
                    mobile: order.mobile,
                    address: order.address,
                    pincode: order.pincode
                },
                userId: objectId(order.userId),
                paymentMethod: order['payment-method'],
                products: products,
                totalAmount: total,
                status: status,
                date: orderDate,
                time: orderTime
            };

            db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response) => {

                resolve(response.ops[0]._id);
            });
        });
    },
    placeProduct: (order, products, total) => {
        return new Promise((resolve, reject) => {
            console.log(order, products, total);
            let status = order['payment-method'] === 'COD' ? 'placed' : 'pending';
            let orderDate = moment().format('DD MMM YYYY');
            let orderTime = moment().format('hh:mmA');

            let orderObj = {
                deliveryDetails: {
                    mobile: order.mobile,
                    address: order.address,
                    pincode: order.pincode
                },
                userId: objectId(order.userId),
                paymentMethod: order['payment-method'],
                products: products,
                totalAmount: total,
                status: status,
                date: orderDate,
                time: orderTime
            };

            db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response) => {
                console.log("go", response.ops[0]._id);
                resolve(response.ops[0]._id);
            });
        });
    },
    getCartProductList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: objectId(userId) })
            console.log("productmm", cart.products);

            resolve(cart.products)
        })
    },
    getUserOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            console.log(userId);
            let orders = await db.get().collection(collection.ORDER_COLLECTION)
                .find({ userId: objectId(userId) }).toArray()
            console.log(orders);
            resolve(orders)
        })
    },
    getAllUserOrders: (userId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { userId: objectId(userId) } // Filter orders by user ID
                },
                {
                    $lookup: {
                        from: collection.USER_COLLECTION,
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'userDetails'
                    }
                },
                {
                    $unwind: '$userDetails'
                },
                {
                    $project: {
                        _id: 1,
                        totalAmount: 1,
                        paymentMethod: 1,
                        status: 1,
                        date: 1,
                        time: 1,
                        userDetails: 1,
                        deliveryDetails: 1,
                        products: {
                            $cond: {
                                if: { $isArray: "$products" },
                                then: "$products",
                                else: [{ item: "$products", quantity: 1 }] // Adjust quantity as needed
                            }
                        }
                    }
                },
                {
                    $unwind: '$products'
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'products.item',
                        foreignField: '_id',
                        as: 'productDetails'
                    }
                },
                {
                    $unwind: '$productDetails'
                },
                {
                    $addFields: {
                        'products.productName': '$productDetails.Name',
                        'products.price': '$productDetails.Offer_Price'
                    }
                },
                {
                    $group: {
                        _id: '$_id',
                        totalAmount: { $first: '$totalAmount' },
                        paymentMethod: { $first: '$paymentMethod' },
                        status: { $first: '$status' },
                        date: { $first: '$date' },
                        time: { $first: '$time' },
                        userDetails: { $first: '$userDetails' },
                        deliveryDetails: { $first: '$deliveryDetails' },
                        products: {
                            $push: {
                                item: '$products.item',
                                quantity: '$products.quantity',
                                productName: '$products.productName',
                                price: '$products.price'
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        totalAmount: 1,
                        paymentMethod: 1,
                        status: 1,
                        date: 1,
                        time: 1,
                        'userDetails._id': 1,
                        'userDetails.First_Name': 1,
                        'userDetails.Last_Name': 1,
                        'userDetails.Email': 1,
                        deliveryDetails: 1,
                        products: 1
                    }
                }
            ]).toArray((err, orders) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(JSON.stringify(orders, null, 2)); // Log the output for verification
                    resolve(orders);
                }
            });
        });
    },


    getOrderProducts: (orderId) => {
        return new Promise(async (resolve, reject) => {
            let orderItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { _id: objectId(orderId) }
                },
                {
                    $unwind: '$products'
                }, {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                }, {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                }, {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                }

            ]).toArray();
            console.log(orderItems)
            resolve(orderItems);
        })
    },
    generateRazorpay: (orderId, total) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: total * 100,
                currency: "INR",
                receipt: orderId
            };

            instance.orders.create(options, function (err, order) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("New order: ", order);
                    resolve(order)
                }
            })

        })
    },
    verifypayment: (details, userId) => {
        return new Promise((resolve, reject) => {
            const crypto = require('crypto');
            let hmac = crypto.createHmac('sha256', 'NxHqrxegFsANJL3mBznh2YvY')
            hmac.update(details['payment[razorpay_order_id]'] + '|' + details['payment[razorpay_payment_id]']);
            hmac = hmac.digest('hex')
            if (hmac == details['payment[razorpay_signature]']) {
                db.get().collection(collection.CART_COLLECTION).removeOne({ user: objectId(userId) });
                resolve()
            } else {
                reject()
            }
        })
    },
    changePaymentStatus: (orderId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION)
                .updateOne({ _id: objectId(orderId) },
                    {
                        $set: {
                            status: 'placed'
                        }
                    }
                ).then(() => {
                    resolve()
                })
        })
    },
    userDetails: (user) => {
        return new Promise(async (resolve, reject) => {
            let userId = user._id
            let userDetails = await db.get().collection(collection.USER_COLLECTION).find({ _id: objectId(userId) }).toArray()
            resolve(userDetails)
            console.log("ur acc:", userDetails);
        })
    },
    verifyPassword: async (userId, enteredPassword) => {

        try {
            const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: objectId(userId) });
            if (!user) throw new Error('User not found');
            return bcrypt.compare(enteredPassword, user.Password);
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    // Update account details


    // Update account details
    updateAccount: (userId, updates) => {
        return new Promise(async (resolve, reject) => {
            try {
                // If the updates object contains a password field and it's not null
                if (updates.Password) {
                    // Hash the password using bcrypt
                    updates.Password = await bcrypt.hash(updates.Password, 10);
                } else {
                    // If password is null, remove it from the updates object
                    delete updates.Password;
                }

                // Update the user's account details in the database
                await db.get().collection(collection.USER_COLLECTION).updateOne(
                    { _id: objectId(userId) },
                    { $set: updates }
                );
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    },

    // Delete account
    deleteAccount: async (userId) => {
        try {
            await db.get().collection(collection.USER_COLLECTION).deleteOne({ _id: objectId(userId) });
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

}


