var db=require('../config/connection')
var collection=require('../config/collections')
const bcrypt=require('bcrypt')
const { log } = require('console')
var objectId=require('mongodb').ObjectID

module.exports={
    doLogin:(adminData)=>{
        return new Promise(async(resolve,reject)=>{
            let loginStatus=false
            let response={}
            let admin=await db.get().collection(collection.ADMIN_COLLECTION).findOne({Email:adminData.Email})
            if(admin){
                 bcrypt.compare(adminData.Password,admin.Password).then((status)=>{
                    if(status){
                        console.log('Admin Loggedin Successfully')
                        response.admin=admin
                        response.status=true
                        resolve(response)
                    }else{
                        console.log('Wrong password entered')
                        resolve({status:false})
                    }
                 })
            }else{
                console.log('No admin in this email id')
                resolve({status:false})
            }
        })
    },
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
      deleteUser:(userId)=>{
        return new Promise((resolve,reject)=>{
           
            db.get().collection(collection.USER_COLLECTION).removeOne({_id:objectId(userId)}).then((response)=>{
               
                resolve(response)
            })
        })
    },
    getAllOrders: () => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION).aggregate([
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
            ]).sort({ Date: -1, time: -1 }).toArray((err, orders) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(JSON.stringify(orders, null, 2)); // Log the output for verification
                    resolve(orders);
                }
            });
        });
    },
    updateOrderStatus: (orderId, status) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION).updateOne(
                { _id: objectId(orderId) },
                { $set: { status: status } }
            ).then((response) => {
               
                resolve(response);
            }).catch((err) => {
                reject(err);
            });
        });
    },
    


    updateUserProdStatus : (Id, Status) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.USER_PRODUCTS_COLLECTION).updateOne(
                { _id: objectId(Id) },
                { $set: { Status: Status } }
            ).then(async (response) => {
                if (Status === "Approved") {
                    try {
                        // Find the document in USER_PRODUCTS_COLLECTION
                        const product = await db.get().collection(collection.USER_PRODUCTS_COLLECTION).findOne({ _id: objectId(Id) });
    
                        if (product) {
                            // Create the product data with the same _id
                            const productData = {
                                _id: objectId(product._id), // Same _id as in USER_PRODUCTS_COLLECTION
                                Name: product.Name,
                                Category: product.Category,
                                Actual_Price: product.Actual_Price,
                                Offer_Price: product.Offer_Price,
                                Product_Owner:product.Product_Owner,
                                Offer_Percentage: product.Offer_Percentage,
                                Description: product.Description,
                                Seller_Id: product.Seller_Id,
                                Seller_First_Name: product.Seller_First_Name,
                                Seller_Last_Name: product.Seller_Last_Name,
                                Seller_Phone: product.Seller_Phone,
                                Seller_Email: product.Seller_Email,
                                Selling_Address: product.Selling_Address,
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
    

  getAllOrdersAscending: () => {
    return new Promise((resolve, reject) => {
      db.get().collection('orders').find().sort({ date: 1 }).toArray().then((orders) => {
        resolve(orders);
      }).catch((error) => {
        reject(error);
      });
    });
  },

  getAllOrdersDescending: () => {
    return new Promise((resolve, reject) => {
      db.get().collection('orders').find().sort({ date: -1 }).toArray().then((orders) => {
        resolve(orders);
      }).catch((error) => {
        reject(error);
      });
    });
  }
      }