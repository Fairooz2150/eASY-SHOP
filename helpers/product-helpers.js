var db = require("../config/connection");
let collection = require("../config/collections");
const moment = require("moment");
const path = require("path");
const fs = require("fs");
const { ObjectId } = require("mongodb");

module.exports = {
  //Add products to eASY Shop
  addProduct: (productDetails) => {
    return new Promise((resolve, reject) => {
      let product = {
        Name: productDetails.Name,
        Category: productDetails.Category,
        Actual_Price: productDetails.Actual_Price,
        Offer_Price: productDetails.Offer_Price,
        Offer_Percentage: productDetails.Offer_Percentage,
        Description: productDetails.Description,
        Product_Owner: productDetails.Product_Owner,
        Carted: productDetails.Carted,
        Stock_Count: productDetails.Stock_Count,
      };

      db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .insertOne(product)
        .then((data) => {
          resolve(data.insertedId);
          console.log(data.insertedId);
        });
    });
  },

  //Get the all eASY products from product collection
  getAllProducts: () => {
    return new Promise(async (resolve, reject) => {
      try {
        let products = await db
          .get()
          .collection(collection.PRODUCT_COLLECTION)
          .find()
          .toArray();
        resolve(products);
      } catch (err) {
        reject(err);
      }
    });
  },

  //Get all user submited products to sell in eASY Shop
  getAllUserProducts: () => {
    return new Promise(async (resolve, reject) => {
      try {
        let products = await db
          .get()
          .collection(collection.USER_PRODUCTS_COLLECTION)
          .find()
          .sort({ Date: -1, time: -1 }) // Sort by date and time in descending order
          .toArray();
        resolve(products);
      } catch (error) {
        reject(error);
      }
    });
  },

  //Delete eASY Products from product collection and status changed to remove for user products collection, and remove that item from users cart
  deleteProduct: (prodId) => {
    return new Promise(async (resolve, reject) => {
      await db
        .get()
        .collection(collection.PRODUCT_COLLECTION)
        .deleteOne({ _id: new ObjectId(prodId) })
        .then(async (response) => {
          await db
            .get()
            .collection(collection.USER_PRODUCTS_COLLECTION)
            .updateOne(
              { _id: new ObjectId(prodId) },
              {
                $set: {
                  Status: "Removed",
                },
              }
            );

          await db
            .get()
            .collection(collection.CART_COLLECTION)
            .updateMany(
              {},
              { $pull: { products: { item: new ObjectId(prodId) } } }
            );
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },

  //Delete user selling products by user
  deleteUserProduct: (prodId) => {
    return new Promise(async (resolve, reject) => {
      try {
        await db
          .get()
          .collection(collection.USER_PRODUCTS_COLLECTION)
          .deleteOne({ _id: new ObjectId(prodId) });
        await db
          .get()
          .collection(collection.PRODUCT_COLLECTION)
          .deleteOne({ _id: new ObjectId(prodId) });
        await db
          .get()
          .collection(collection.CART_COLLECTION)
          .updateMany(
            {},
            { $pull: { products: { item: new ObjectId(prodId) } } }
          );
        resolve();
      } catch (error) {
        console.error("Error deleting user product:", error);
        reject(error);
      }
    });
  },

  //Delete Pending products(Not approved) or products of status:pending
  deletePendingProduct: (prodId) => {
    return new Promise((resolve, reject) => {
      db.get()
        .collection(collection.USER_PRODUCTS_COLLECTION)
        .deleteOne({ _id: new ObjectId(prodId) })
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },

  //Remove Items(products) from cart
  removeCartProducts: (userId) => {
    return new Promise((resolve, reject) => {
      db.get()
        .collection(collection.CART_COLLECTION)
        .deleteOne({ user: new ObjectId(userId) })
        .then(() => {
          resolve();
        });
    });
  },

  //Get Products Full details
  getProductDetails: (proId) => {
    return new Promise((resolve, reject) => {
      db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .findOne({ _id: new ObjectId(proId) })
        .then((product) => {
          if (product == null) {
            db.get()
              .collection(collection.USER_PRODUCTS_COLLECTION)
              .findOne({ _id: new ObjectId(proId) })
              .then((product) => {
                resolve(product);
              });
          } else {
            resolve(product);
          }
        });
    });
  },

  //Change the Stock Count of Products
  changeStockCount: (proId) => {
    return new Promise((resolve, reject) => {
      db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .findOneAndUpdate(
          { _id: new ObjectId(proId) },
          [
            {
              $set: {
                Stock_Count: { $subtract: [{ $toInt: "$Stock_Count" }, 1] },
              },
            },
          ],
          { returnOriginal: false }
        )
        .then((result) => {
          db.get()
            .collection(collection.USER_PRODUCTS_COLLECTION)
            .findOneAndUpdate(
              { _id: new ObjectId(proId) },
              [
                {
                  $set: {
                    Stock_Count: { $subtract: [{ $toInt: "$Stock_Count" }, 1] },
                  },
                },
              ],
              { returnOriginal: false }
            );
          if (result.value) {
            resolve(result.value);
          } else {
            reject("Product not found or stock not updated");
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  },

  //Reduce Stock Count of product by adding items to cart
  reduceStockCount: (proId) => {
    return new Promise((resolve, reject) => {
      db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .findOneAndUpdate(
          { _id: new ObjectId(proId) },
          [
            {
              $set: {
                Stock_Count: { $subtract: [{ $toInt: "$Stock_Count" }, 1] },
              },
            },
          ],
          { returnDocument: "after" }
        )
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  },

  //Save the edited product details by Admin
  updateProduct: (proId, proDetails) => {
    return new Promise((resolve, reject) => {
      db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .updateOne(
          { _id: new ObjectId(proId) },
          {
            $set: {
              Name: proDetails.Name,
              Description: proDetails.Description,
              Actual_Price: proDetails.Actual_Price,
              Offer_Price: proDetails.Offer_Price,
              Category: proDetails.Category,
              Offer_Percentage: proDetails.Offer_Percentage,
              Product_Owner: proDetails.Product_Owner,
              Stock_Count: proDetails.Stock_Count,
            },
          }
        )
        .then((response) => {
          resolve();
        });
    });
  },

  //Update User's Selling Product Details
  updateUserProduct: (proId, product) => {
    return new Promise((resolve, reject) => {
      let Date = moment().format("DD MMM YYYY");
      let Time = moment().format("hh:mmA");
      if (product.Status === "Approved") {
        db.get()
          .collection(collection.PRODUCT_COLLECTION)
          .updateOne(
            { _id: new ObjectId(proId) },
            {
              $set: {
                Name: product.Name,
                Category: product.Category,
                Actual_Price: product.Actual_Price,
                Product_Owner: product.Product_Owner,
                Offer_Price: product.Offer_Price,
                Offer_Percentage: product.Offer_Percentage,
                Description: product.Description,
                Shop_Address: product.Shop_Address,
                Stock_Count: product.Stock_Count,
                Phone: product.Phone,
                Status: product.Status,
                Email: product.Email,
                Whatsapp: product.Whatsapp,
                Carted: product.Carted,
                Updations: product.Updations,
                UpdatedDate: Date,
                UpdatedTime: Time,
              },
            }
          );

        db.get()
          .collection(collection.USER_PRODUCTS_COLLECTION)
          .updateOne(
            { _id: new ObjectId(proId) },
            {
              $set: {
                Name: product.Name,
                Category: product.Category,
                Actual_Price: product.Actual_Price,
                Product_Owner: product.Product_Owner,
                Offer_Price: product.Offer_Price,
                Offer_Percentage: product.Offer_Percentage,
                Description: product.Description,
                Shop_Address: product.Shop_Address,
                Stock_Count: product.Stock_Count,
                Phone: product.Phone,
                Status: product.Status,
                Email: product.Email,
                Whatsapp: product.Whatsapp,
                Carted: product.Carted,
                Updations: product.Updations,
                UpdatedDate: Date,
                UpdatedTime: Time,
              },
            }
          );
      } else {
        db.get()
          .collection(collection.USER_PRODUCTS_COLLECTION)
          .updateOne(
            { _id: new ObjectId(proId) },
            {
              $set: {
                Name: product.Name,
                Category: product.Category,
                Actual_Price: product.Actual_Price,
                Product_Owner: product.Product_Owner,
                Offer_Price: product.Offer_Price,
                Offer_Percentage: product.Offer_Percentage,
                Description: product.Description,
                Shop_Address: product.Shop_Address,
                Stock_Count: product.Stock_Count,
                Status: product.Status,
                Phone: product.Phone,
                Email: product.Email,
                Whatsapp: product.Whatsapp,
                Carted: product.Carted,
                Updations: product.Updations,
                UpdatedDate: Date,
                UpdatedTime: Time,
              },
            }
          );
      }
    });
  },

  //Get search results
  searchProducts: (query) => {
    return new Promise(async (resolve, reject) => {
      try {
        const filter = {
          $or: [
            { Name: { $regex: query, $options: "i" } },
            { Description: { $regex: query, $options: "i" } },
            { Offer_Price: { $regex: query, $options: "i" } },
            { Category: { $regex: query, $options: "i" } },
            { Actual_Price: { $regex: query, $options: "i" } },
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: [
                      "$Name",
                      " ",
                      "$Description",
                      " ",
                      "$Offer_Price",
                      " ",
                      "$Category",
                      " ",
                      "$Actual_Price",
                      " ",
                      {
                        $cond: {
                          if: { $eq: ["$Product_Owner", "Admin"] },
                          then: " easy assurance",
                          else: "",
                        },
                      },
                    ],
                  },
                  regex: query,
                  options: "i",
                },
              },
            },
          ],
        };

        const products = await db
          .get()
          .collection(collection.PRODUCT_COLLECTION)
          .find(filter)
          .toArray();
        resolve(products);
      } catch (error) {
        reject(error);
      }
    });
  },

  //Add User selling products to user collection for get approve from adming
  addUserProduct: (product) => {
    return new Promise((resolve, reject) => {
      let Date = moment().format("DD MMM YYYY");
      let Time = moment().format("hh:mmA");

      let productDetails = {
        Name: product.Name,
        Category: product.Category,
        Product_Owner: product.Product_Owner,
        Actual_Price: product.Actual_Price,
        Offer_Price: product.Offer_Price,
        Offer_Percentage: product.Offer_Percentage,
        Description: product.Description,
        Seller_Id: new ObjectId(product.User_Id),
        Seller_First_Name: product.User_First_Name,
        Seller_Last_Name: product.User_Last_Name,
        Gender: product.Gender,
        Phone: product.Phone,
        Email: product.Email,
        Whatsapp: product.Whatsapp,
        Shop_Address: product.Shop_Address,
        Stock_Count: product.Stock_Count,
        Status: product.Status,
        Updations: product.Updations,
        Date: Date,
        Time: Time,
      };

      db.get()
        .collection(collection.USER_PRODUCTS_COLLECTION)
        .insertOne(productDetails)
        .then((data) => {
          resolve(data.insertedId);
          console.log(data.insertedId);
        });
    });
  },

  //Get the Product full uploaded images
  /**
   * Get product details including images stored in the public folder
   * @param {String} productId - The ID of the product
   * @returns {Object} - The product details including image file names
   */

  getProductImages: (productId) => {
    return new Promise(async (resolve, reject) => {
      try {
        const productCollection = db
          .get()
          .collection(collection.PRODUCT_COLLECTION); // Replace with your collection name
        const product = await productCollection.findOne({
          _id: new ObjectId(productId),
        });

        if (!product) {
          throw new Error("Product not found");
        }

        // Fetch images from the public/product-images folder
        const imageDir = path.join(__dirname, "../public/product-images");
        const imageFiles = fs.readdirSync(imageDir);

        // Filter images that belong to this product
        const productImages = imageFiles.filter((file) =>
          file.startsWith(productId)
        );
        product.images = productImages;
        resolve(product);
      } catch (error) {
        console.error("Error fetching product details:", error);
        throw error;
      }
    });
  },

  //Get the Status:Pending Product Images
  getPndgProductImages: (productId) => {
    return new Promise(async (resolve, reject) => {
      try {
        const productCollection = db
          .get()
          .collection(collection.USER_PRODUCTS_COLLECTION); // Replace with your collection name
        const product = await productCollection.findOne({
          _id: new ObjectId(productId),
        });

        if (!product) {
          throw new Error("Pending Product not found");
        }

        // Fetch images from the public/product-images folder
        const imageDir = path.join(__dirname, "../public/product-images");
        const imageFiles = fs.readdirSync(imageDir);

        // Filter images that belong to this product
        const productImages = imageFiles.filter((file) =>
          file.startsWith(productId)
        );
        product.images = productImages;
        resolve(product);
      } catch (error) {
        console.error("Error fetching pending product details:", error);
        throw error;
      }
    });
  },

  //Update/upload new Product Images by editing
  updateProductImages: (productId, updatedImages) => {
    return new Promise((resolve, reject) => {
      db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .updateOne(
          { _id: new ObjectId(productId) },
          {
            $set: {
              images: updatedImages,
            },
          }
        )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },

  //Update/upload new Product Images by editing (not Approved)
  updatePndgProductImages: (productId, updatedImages) => {
    return new Promise((resolve, reject) => {
      db.get()
        .collection(collection.USER_PRODUCTS_COLLECTION)
        .updateOne(
          { _id: new ObjectId(productId) },
          {
            $set: {
              images: updatedImages,
            },
          }
        )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
};
