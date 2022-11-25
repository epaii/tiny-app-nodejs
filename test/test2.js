const App = require("../src");

let app = new App();

app.use(function (ctx, globalData) {

}).route("/test", function (ctx) {
    return ctx.params();
}).listen(8891)