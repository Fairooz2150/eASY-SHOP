var db = require('../config/connection')
var collection = require('../config/collections')
const bcrypt = require('bcrypt')
const { log } = require('console')
const { ObjectId } = require('mongodb');


module.exports = {

    //verify the Admin-login details
    doLogin: (adminData) => { 
        return new Promise(async (resolve, reject) => {
            let loginStatus = false
            let response = {}
            let admin = await db.get().collection(collection.ADMIN_COLLECTION).findOne({ Email: adminData.Email })
            if (admin) {
                bcrypt.compare(adminData.Password, admin.Password).then((status) => {
                    if (status) {
                        console.log('Admin Loggedin Successfully')
                        response.admin = admin
                        response.status = true
                        resolve(response)
                    } else {
                        console.log('Wrong password entered')
                        resolve({ status: false })
                    }
                })
            } else {
                console.log('No admin in this email id')
                resolve({ status: false })
            }
        })
    },

    //get all eASY users with details
    getAllUsers: () => { 
        return new Promise(async (resolve, reject) => {
            try {
                let users = await db.get().collection(collection.USER_COLLECTION).find().toArray();
                resolve(users);
            } catch (error) {
                reject(error);
            }
        });
    },

    //For delete user
    deleteUser: (userId) => { 
        return new Promise((resolve, reject) => {

            db.get().collection(collection.USER_COLLECTION).deleteOne({ _id: new ObjectId(userId) }).then((response) => {

                resolve(response)
            })
        })
    },

    //get all the orders
    getAllOrders: () => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION).aggregate([
                // Join with user collection
                {
                    $lookup: {
                        from: collection.USER_COLLECTION,
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'userDetails'
                    }
                },
                {
                    $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true }
                },
                // Unwind products array
                {
                    $unwind: { path: '$products', preserveNullAndEmptyArrays: true }
                },
                // Join with product collection
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'products.item',
                        foreignField: '_id',
                        as: 'productDetails'
                    }
                },
                {
                    $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true }
                },
                // Add product details to products array
                {
                    $addFields: {
                        'products.productName': { $ifNull: ['$productDetails.Name', 'Unknown'] },
                        'products.price': { $ifNull: ['$productDetails.Offer_Price', 0] },
                        'products.category': { $ifNull: ['$productDetails.Category', 'Uncategorized'] }
                    }
                },
                // Group by order _id to aggregate product details
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
                                price: '$products.price',
                                category: '$products.category'
                            }
                        }
                    }
                },
                // Project fields to include in the final output
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
                        'userDetails.Gender': 1,
                        deliveryDetails: 1,
                        products: 1
                    }
                },
                // Optional: Sort by date and time
                {
                    $sort: { date: -1, time: -1 }
                }
            ]).toArray((err, orders) => {
                if (err) {
                    console.error("Error in aggregation:", err);
                    return reject(err);
                }
                console.log("Aggregated Orders:", JSON.stringify(orders, null, 2)); // Log the output for verification
                resolve(orders);
            });
        });
    }
,    

    //update the user order status from placed->shipped->deliver
    updateOrderStatus: (orderId, status) => { 
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION).updateOne(
                { _id: new ObjectId(orderId) },
                { $set: { status: status } }
            ).then((response) => {

                resolve(response);
            }).catch((err) => {
                reject(err);
            });
        });
    },

    //update the user products to approved or declined by admin
    updateUserProdStatus: (Id, Status) => { 
        return new Promise((resolve, reject) => {
            db.get().collection(collection.USER_PRODUCTS_COLLECTION).updateOne(
                { _id: new ObjectId(Id) },
                { $set: { Status: Status } }
            ).then(async (response) => {
                if (Status === "Approved") {
                    try {
                        // Find the document in USER_PRODUCTS_COLLECTION
                        const product = await db.get().collection(collection.USER_PRODUCTS_COLLECTION).findOne({ _id: new ObjectId(Id) });

                        if (product) {
                            // Create the product data with the same _id
                            const productData = {
                                _id: new ObjectId(product._id), // Same _id as in USER_PRODUCTS_COLLECTION
                                Name: product.Name,
                                Category: product.Category,
                                Actual_Price: product.Actual_Price,
                                Offer_Price: product.Offer_Price,
                                Product_Owner: product.Product_Owner,
                                Offer_Percentage: product.Offer_Percentage,
                                Description: product.Description,
                                Seller_Id: product.Seller_Id,
                                Seller_First_Name: product.Seller_First_Name,
                                Seller_Last_Name: product.Seller_Last_Name,
                                Phone: product.Phone,
                                Email: product.Email,
                                Shop_Address: product.Shop_Address,
                                Stock_Count: product.Stock_Count,
                                Whatsapp: product.Whatsapp,
                                Status: "Approved",
                                Date: product.Date,
                                Time: product.Time

                            };

                            // Insert the product data into PRODUCT_COLLECTION
                            await db.get().collection(collection.PRODUCT_COLLECTION).insertOne(productData);
                        }

                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    resolve(response);
                }
            }).catch((err) => {
                reject(err);
            });
        });
    },

    //get the all messages from contact page by users
    getAllMessages: () => { 
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.MESSAGE_COLLECTION).find().toArray().then((messages) => {
                resolve(messages);
            }).catch((error) => {
                reject(error);
            });
        });
    },

}