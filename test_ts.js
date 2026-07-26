var _a;
var arr = [{}];
try {
    console.log("TS Optional Chaining:", (_a = arr[1]) === null || _a === void 0 ? void 0 : _a.name.toLowerCase());
}
catch (e) {
    console.log("ERROR:", e.message);
}
