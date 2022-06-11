const express = require("express"); // Import express module server
const path = require("path"); // Import path module for redirecting to other pages
const router = express.Router();
const request = require("request"); // Import request module for making HTTP requests
const urlCrypt = require("url-crypt")(
    '~{ry*I)==yU/]9<7DPk!Hj"R#:-/Z7(hTBnlRS=4CXF'
); // Import url-crypt module for encrypting and decrypting URLs
const fs = require("fs"); // Import fs module for reading and writing files
const handlebars = require("handlebars"); // Import handlebars module for rendering templates

const encryption = require("../encryption"); // Import encryption module for encrypting and decrypting data

const Styliner = require("styliner"); // Import styliner module for styling html
const options = { urlPrefix: "dir/", noCSS: true }; // Set options for styliner module
const styliner = new Styliner(__dirname, options); // Create styliner object

// User model
const User = require("../models/User");

// promoCode model
const PromoCode = require("../models/PromoCode");

//env variables
require("dotenv").config();

// Get the user's profile
const nodemailer = require("nodemailer");

// Create a transport object for sending email
const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS,
    },
});

// testing nodemailer success
transporter.verify((err, success) => {
    if (err) {
        console.log(err);
    } else {
        console.log("Ready for messages");
        console.log(success);
    }
});

// Login Page
router.get("/login", (req, res) => {
    res.render("login");
});

// Register Page
router.get("/register", (req, res) => {
    res.render("register");
});

// Sent email Page
router.get("/sentEmail", (req, res) => {
    res.render("sentEmail");
});

// Sent email Page for reset password
router.get("/sentResetPasswordEmail", (req, res) => {
    res.render("sentResetPasswordEmail");
});

//
router.get("/passChangedSucc", (req, res) => {
    res.render("passChangedSucc");
});

// Register Handle
router.post("/register", async(req, res) => {
    const { firstName, lastName, email, password, password2, promoCode } =
    req.body;
    // Reciving data from the form
    const data = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        password: req.body.password,
        promoCode: req.body.promoCode,
    };

    const base64 = urlCrypt.cryptObj(data);
    // Registration validation
    let originalSource = fs.readFileSync(
        path.join(__dirname, "..", "views", "emailConfirmation.html"),
        "utf8"
    );
    let registrationiLink =
        "https://clientserver-elctronics-store.herokuapp.com/users/register/" +
        base64;

    // Recaptcha validation
    const captcha = req.body["g-recaptcha-response"];

    let flagSendMail = 1;

    let errors = [];

    //Check required fields
    if (!firstName || !lastName || !email || !password || !password2) {
        errors.push({ msg: "Please fill in all fields" });
    }
    // captcha not used
    if (!captcha) {
        errors.push({ msg: "Please select I am not a robot" });
    }
    //Check passwords match
    if (password !== password2) {
        errors.push({ msg: "Passwords do not match" });
    }

    //Check passwords length
    if (password.length < 6) {
        errors.push({ msg: "Passwords Should be at least 6 characters" });
    }

    //Check password contain number
    if (!/\d/.test(password)) {
        errors.push({ msg: "Password should have a number" });
    }

    //resul.send("This promo code is not in the system.");//

    if (errors.length > 0) {
        res.render("register", {
            errors,
            firstName,
            lastName,
            email,
            password,
            password2,
            promoCode,
        });
    } else {
        // Secret Key
        const secretKey = "6LfmtiYgAAAAAEc_98Qfm9CaPiNHLzocuKxG8FZ_";

        // Verify URL
        const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captcha}&remoteip=${req.connection.remoteAddress}`;

        // Make Request to VerifyURL
        request(verifyURL, async(err, response, body) => {
            body = JSON.parse(body);
            // If not success
            if (body.success !== undefined && !body.success) {
                console.log("did'nt success");
                res.redirect("/users/login");
            } else {
                // success
                // Validation passed
                if (promoCode != "") {
                    const promoCodeCheck = await PromoCode.findOne({
                        promo_code: promoCode,
                    });
                    if (!promoCodeCheck) {
                        errors.push({ msg: "This promo code is not in the system." });
                        flagSendMail = 0;
                    }
                }

                const userExistCheck = await User.findOne({ email: email });
                if (userExistCheck) {
                    errors.push({
                        msg: "Sorry but this email already in use, please try another email",
                    });
                    flagSendMail = 0;
                }

                // erros
                if (!flagSendMail) {
                    res.render("register", {
                        errors,
                        firstName,
                        lastName,
                        email,
                        password,
                        password2,
                        promoCode,
                    });
                }

                // Succsessful email confirmation
                else {
                    function sendEmail(source) {
                        const mailOptions = {
                            from: "clientservermail123123@gmail.com",
                            to: email,
                            subject: "Email verification",
                            text: "Paste the url below into your browser to Emailify!" +
                                registrationiLink,
                            html: source,
                        };

                        transporter
                            .sendMail(mailOptions)
                            .then(() => {
                                // email sent and verification record saved
                                res.redirect("/users/sentEmail");
                            })
                            .catch((err) => {
                                console.log(err);
                                res.json({
                                    status: "FAILED",
                                    message: "Verification email failed",
                                });
                            });
                    }

                    styliner.processHTML(originalSource).then(function(processedSource) {
                        const template = handlebars.compile(processedSource);
                        const data = {
                            username: firstName,
                            lastname: lastName,
                            link: registrationiLink,
                        };
                        const result = template(data);
                        sendEmail(result);
                    });
                }
            }
        });
    }
});

// Register Handle
router.get("/register/:base64", async function(req, res) {
    try {
        const UserObj = urlCrypt.decryptObj(req.params.base64);
        const EncryptedPassword = encryption.encrypt(UserObj.password);
        UserObj.password = EncryptedPassword;
        await User.create(UserObj);
        res.redirect("/users/login");
    } catch (e) {
        return res.status(404).send("Bad");
    }
});

// Login Handle
router.post("/login", async(req, res, next) => {
    const captcha = req.body["g-recaptcha-response"];
    const { email, password, rememberOn } = req.body;

    let errors = [];

    //Check required fields
    if (!email || !password) {
        errors.push({ msg: "Please fill in all fields" });
    }
    // captcha not used
    if (!captcha) {
        errors.push({ msg: "Please select I am not a robot" });
    }
    if (errors.length > 0) {
        res.status(400).json({
            status: "fail",
            message: errors,
        });
    } else {
        // Secret Key
        // const secretKey = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
        const secretKey = "6LfmtiYgAAAAAEc_98Qfm9CaPiNHLzocuKxG8FZ_";

        // Verify URL
        const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captcha}&remoteip=${req.socket.remoteAddress}`;

        // Make Request to VerifyURL
        request(verifyURL, async(err, response, body) => {
            body = JSON.parse(body);
            // If not success
            if (body.success !== undefined && !body.success) {
                console.log("did'nt success");
                res.redirect("/users/login");
            } else {
                // success

                const EncryptedPassword = encryption.encrypt(password);
                const LoggedUser = await User.findOne({
                    $and: [{ email: email }, { password: EncryptedPassword }],
                });

                if (!LoggedUser) {
                    errors.push({ msg: "User Not Found" });
                    res.status(400).json({
                        status: "fail",
                        message: errors,
                    });
                } else {
                    res.send(LoggedUser);
                }
            }
        });
    }
});

// Reset Password Handle get
router.get("/resetPassword", function(req, res) {
    res.render("resetPassword");
});

// Reset Password Handle post (send email)
router.post("/resetPassword", function(req, res) {
    const { email } = req.body;
    let errors = [];

    //Check required field
    if (!email) {
        errors.push({ msg: "Please fill in Email field" });
    }

    if (errors.length > 0) {
        res.render("resetPassword", {
            errors,
            email,
        });
    } else {
        // Validation passed
        User.findOne({ email: email }).then((user) => {
            if (!user) {
                //User does not exists
                errors.push({ msg: "Email is not found" });
                res.render("resetPassword", {
                    email: email,
                });
            } else {
                const data = {
                    email: email,
                };
                const base64 = urlCrypt.cryptObj(data);

                const resetPasswordLink =
                    "https://clientserver-elctronics-store.herokuapp.com/users/updatePassword/" +
                    base64;
                let originalSource = fs.readFileSync(
                    path.join(__dirname, "..", "views", "forgetPasswordEmail.html"),
                    "utf8"
                );

                function sendEmail1(source) {
                    const mailOptions = {
                        from: "clientservermail123123@gmail.com",
                        to: email,
                        subject: "Reset password",
                        text: "Paste the url below into your browser to getPassword!",
                        html: source,
                    };

                    transporter.sendMail(mailOptions, function(error, info) {
                        if (error) {
                            res.json({
                                status: "FAILED",
                                message: "ERROR",
                            });
                        } else {
                            res.redirect("/users/sentResetPasswordEmail");
                        }
                    });
                }
                styliner.processHTML(originalSource).then(function(processedSource) {
                    const template = handlebars.compile(processedSource);
                    const data = { link: resetPasswordLink };
                    const result = template(data);
                    sendEmail1(result);
                    resul.send("Success");
                });
            }
        });
    }
});

// Update Password Handle get
router.get("/updatePassword/:base64", function(req, res) {
    res.render("updatePassword", {
        base64: req.params.base64,
    });
});

// Update Password Handle post (update password)
router.post("/updatePassword/:base64", async function(req, res) {
    const { password, password2 } = req.body;
    const base64 = req.params.base64;
    let originalSource = fs.readFileSync(
        path.join(__dirname, "..", "views", "emailUpdatePassword.html"),
        "utf8"
    );

    let errors = [];

    //Check required fields
    if (!password || !password2) {
        errors.push({ msg: "Please fill in all fields" });
    }

    //Check passwords match
    if (password !== password2) {
        errors.push({ msg: "Passwords do nt match" });
    }

    //Check passwords length
    if (password.length < 6) {
        errors.push({ msg: "Passwords Should be at least 6 characters" });
    }

    if (errors.length > 0) {
        res.render("updatePassword", {
            errors,
            base64,
            password,
            password2,
        });
    } else {
        // New Password
        const newPass = req.body.password;
        const EncryptedPassword = encryption.encrypt(newPass);
        try {
            const EmailObj = urlCrypt.decryptObj(base64);
            await User.updateOne({ email: EmailObj.email }, { password: EncryptedPassword });

            function sendEmail1(source) {
                const mailOptions = {
                    from: "clientservermail123123@gmail.com",
                    to: EmailObj.email,
                    subject: "Password Changed Succsufly",
                    text: "Updated password!",
                    html: source,
                };

                transporter.sendMail(mailOptions, function(error, info) {
                    if (error) {
                        res.json({
                            status: "FAILED",
                            message: "ERROR",
                        });
                    } else {
                        res.redirect("/users/passChangedSucc");
                    }
                });
            }
            // Send Email to user with new password 
            styliner.processHTML(originalSource).then(function(processedSource) {
                const template = handlebars.compile(processedSource);
                const data = { info: "We have really important information for you" };
                const result = template(data);
                sendEmail1(result);
            });
        } catch (e) {
            return res.status(404).send("Bad");
        }
    }
});

// Request for getting user profile with all data from database
router.post("/getProfile", async function(req, res) {
    const { id } = req.body;
    let user = await User.findById({ _id: id });
    let EncryptedPassword = encryption.decrypt(user.password);
    user.password = EncryptedPassword;
    res.send(user);
});

// Send request to update user profile
router.post("/updateProfile", async function(req, res) {
    let originalSource = fs.readFileSync(
        path.join(__dirname, "..", "views", "emailWantToChange.html"),
        "utf8"
    );
    const {
        firstName,
        lastName,
        email,
        phone,
        country,
        city,
        street,
        zipCode,
        prevEmail,
        id,
    } = req.body;
    const filter = { _id: id };
    const update = {
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        country: country,
        city: city,
        street: street,
        zipCode: zipCode,
    };

    // find and update the user with the new information
    await User.findOneAndUpdate(filter, update);


    if (email != prevEmail) {
        const userExistCheck = await User.findOne({ email: email });
        if (userExistCheck) {
            res.send(
                "This email already in use , we can't change it. your other data has been saved."
            );
        }
        const data = {
            id: id,
            email: email,
        };
        const base64 = urlCrypt.cryptObj(data);
        const registrationiLink =
            "https://clientserver-elctronics-store.herokuapp.com/users/updateMail/" +
            base64;

        function sendEmail1(source) {
            const mailOptions = {
                from: "clientservermail123123@gmail.com",
                to: email,
                subject: "Confirm Changing email",
                text: "Paste the url below into your browser to getPassword!",
                html: source,
            };

            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    res.json({
                        status: "FAILED",
                        message: "ERROR",
                    });
                } else {
                    res.send(
                        "The profile has been updated! and email sent to you to change your mail!"
                    );
                }
            });
        }

        styliner.processHTML(originalSource).then(function(processedSource) {
            const template = handlebars.compile(processedSource);
            const data = {
                firstName: firstName,
                lastName: lastName,
                link: registrationiLink,
            };
            const result = template(data);
            sendEmail1(result);
        });
        res.send(
            "The profile has been updated! and email sent to you to change your mail!"
        );
    } else {
        res.send("The details has changed successfuly!");
    }
});

router.get("/updateMail/:base64", async function(req, res) {
    try {
        const UserObj = urlCrypt.decryptObj(req.params.base64);
        await User.findOneAndUpdate({ _id: UserObj.id }, { email: UserObj.email });
        res.redirect("/users/login");
    } catch (e) {
        return res.status(404).send("Bad");
    }
});

// Request for changing user password with validation tests 
router.post("/changePassword", async function(req, res) {
    const { oldPassword, newPassword, confirmPassword, id } = req.body;

    let user = await User.findById({ _id: id });
    let currentUserPassword = encryption.decrypt(user.password);
    let errors = [];

    //Check required fields
    if (!oldPassword || !newPassword || !confirmPassword) {
        errors.push({ msg: "Please fill in all fields" });
    }

    //Check password new equals to old
    if (newPassword == oldPassword) {
        errors.push({ msg: "Your new password is your old password" });
    }

    //Check passwords match
    if (newPassword !== confirmPassword) {
        errors.push({ msg: "Your passwords do not match. please try again" });
    }

    if (oldPassword != currentUserPassword) {
        errors.push({ msg: "Your old password not match your current password" });
    }

    //Check passwords length
    if (newPassword.length < 6) {
        errors.push({ msg: "Passwords Should be at least 6 characters" });
    }

    if (errors.length > 0) {
        res.status(400).json({
            status: "fail",
            message: errors,
        });
    } else {
        // New Paswword
        const EncryptedPassword = encryption.encrypt(newPassword);
        try {
            await User.updateOne({ email: user.email }, { password: EncryptedPassword });
            res.status(200).json({
                status: "success",
                data: "The password was changed!",
            });
        } catch (e) {
            return res.status(404).send("Bad");
        }
    }
});

module.exports = router;