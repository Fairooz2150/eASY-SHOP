var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const nocache = require('nocache');

var userRouter = require('./routes/user');
var adminRouter = require('./routes/admin');
var hbs = require('express-handlebars');
var app = express();
var fileupload = require('express-fileupload');
var db = require('./config/connection');
var session = require('express-session');

// Register Handlebars helpers and set up the view engine
const hbsInstance = hbs.create({
  extname: 'hbs',
  defaultLayout: 'layout',
  layoutsDir: path.join(__dirname, 'views/layout/'),
  partialsDir: path.join(__dirname, 'views/partials/'),
  helpers: {
    incrementedIndex: function (index) {
      return index + 1;
    },
    ifEquals: function (arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    }
  }
});

app.engine('hbs', hbsInstance.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileupload());
app.use(session({ secret: "Key", cookie: { maxAge: 600000 } }));
app.use(nocache());

db.connect((err) => {
  if (err) console.log("Connection Error: " + err);
  else console.log("Database Connected to port 27017");
});

app.use('/', userRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
