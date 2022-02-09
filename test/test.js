const App = require("../src/index");

new App().init((app) => {

}).init((app) => {
    //do some work
}).init( async (app) => {
    await doSomeWork();
}).init(function (app) {
    return new Promise(ok => {
        setTimeout(() => {
            //do some work
            ok();
        }, 3000);
    })
}).route("/", function (ctx) {
    ctx.success("hello world");
}).module("/user", __dirname + "/user").listen(8896);