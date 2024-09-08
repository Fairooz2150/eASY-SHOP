const { MongoClient } = require('mongodb');

const state = {
    db: null
};

const url = 'mongodb+srv://fairooz:fairooz@cluster0.6t6bl.mongodb.net/eASY-SHOP?retryWrites=true&w=majority';
const dbName = 'eASY-SHOP';

module.exports.connect = function (done) {
    MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(client => {
            state.db = client.db(dbName);
            console.log('Database connected successfully');
            done();
        })
        .catch(err => {
            console.error('Database connection failed', err);
            done(err);
        });
};

module.exports.get = function () {
    if (!state.db) {
        throw new Error('Database not initialized');
    }
    return state.db;
};
