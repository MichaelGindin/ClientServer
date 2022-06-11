const express = require("express");
const router = express.Router();

// Login page
router.get("/", (req, res) => {
    res.render("login");
});

// Buy Pc page
router.get("/buyPc", (req, res) => {
    res.render("buyPc");
});

// Buy Cell phone page
router.get("/buyCellPhone", (req, res) => {
    res.render("buyCellPhone");
});

// Dashbord page
router.get("/dashboard", (req, res) => {
    res.render("dashboard");
});

// About page
router.get("/about", (req, res) => {
    res.render("about");
});

// Profile page (user profile)
router.get("/profile", (req, res) => {
    res.render("profile");
});

// Page Not Found
router.get("/PageNotFound", (req, res) => {
    res.render("404");
});

// Export the router
module.exports = router;