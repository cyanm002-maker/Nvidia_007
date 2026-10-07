require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    }
);

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(express.static("public"));


// ============================================
// HOME
// ============================================

app.get("/", (req, res) => {
    res.redirect("/login");
});


// ============================================
// SIGNUP PAGE
// ============================================

app.get("/signup", (req, res) => {
    res.render("signup", {
        error: null
    });
});


// ============================================
// SIGNUP
// ============================================

app.post("/signup", async (req, res) => {

    try {

        const {
            email,
            password,
            name,
            age,
            birthday,
            sex,
            country
        } = req.body;


        // Basic validation

        if (
            !email ||
            !password ||
            !name ||
            !age ||
            !birthday ||
            !sex ||
            !country
        ) {
            return res.render("signup", {
                error: "Please fill in all fields."
            });
        }


        const ageNumber = Number(age);


        if (
            !Number.isInteger(ageNumber) ||
            ageNumber < 0 ||
            ageNumber > 150
        ) {
            return res.render("signup", {
                error: "Please enter a valid age."
            });
        }


        if (password.length < 6) {
            return res.render("signup", {
                error: "Password must be at least 6 characters."
            });
        }


        // Create Supabase Auth user

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,

            options: {
                data: {
                    name: name,
                    age: ageNumber,
                    birthday: birthday,
                    sex: sex,
                    country: country
                }
            }
        });


        if (error) {
            console.error(error);

            return res.render("signup", {
                error: error.message
            });
        }


        /*
         * If email confirmation is enabled in Supabase,
         * session will be null.
         */

        if (!data.session) {

            return res.render("login", {
                error: "Account created. Please check your email and verify your account before logging in."
            });
        }


        // Save access token in HTTP-only cookie

        res.cookie("access_token", data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 1000
        });


        res.redirect("/dashboard");

    } catch (error) {

        console.error(error);

        res.render("signup", {
            error: "Something went wrong."
        });
    }
});


// ============================================
// LOGIN PAGE
// ============================================

app.get("/login", (req, res) => {

    res.render("login", {
        error: null
    });

});


// ============================================
// LOGIN
// ============================================

app.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.render("login", {
                error: "Email and password are required."
            });

        }


        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });


        if (error) {

            return res.render("login", {
                error: error.message
            });

        }


        // Store access token in HTTP-only cookie

        res.cookie("access_token", data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 1000
        });


        res.redirect("/dashboard");

    } catch (error) {

        console.error(error);

        res.render("login", {
            error: "Something went wrong."
        });

    }

});


// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

async function requireAuth(req, res, next) {

    try {

        const accessToken = req.cookies.access_token;


        if (!accessToken) {
            return res.redirect("/login");
        }


        /*
         * getUser() asks the Supabase Auth server
         * to validate the access token.
         */

        const {
            data,
            error
        } = await supabase.auth.getUser(accessToken);


        if (error || !data.user) {

            res.clearCookie("access_token");

            return res.redirect("/login");
        }


        // Store user for the next route

        req.user = data.user;

        next();

    } catch (error) {

        console.error(error);

        res.clearCookie("access_token");

        res.redirect("/login");
    }
}


// ============================================
// DASHBOARD
// ============================================

app.get("/dashboard", requireAuth, async (req, res) => {

    try {

        /*
         * Create a Supabase client using the
         * logged-in user's access token.
         *
         * This allows RLS to identify auth.uid().
         */

        const userSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_PUBLISHABLE_KEY,
            {
                accessToken: async () => req.cookies.access_token,

                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                }
            }
        );


        const {
            data: profile,
            error
        } = await userSupabase
            .from("profiles")
            .select("*")
            .eq("id", req.user.id)
            .single();


        if (error) {

            console.error(error);

            return res.send("Could not load profile.");
        }


        res.render("dashboard", {
            user: req.user,
            profile: profile
        });


    } catch (error) {

        console.error(error);

        res.send("Something went wrong.");
    }

});


// ============================================
// LOGOUT
// ============================================

app.post("/logout", async (req, res) => {

    try {

        const accessToken = req.cookies.access_token;


        if (accessToken) {

            const userSupabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_PUBLISHABLE_KEY,
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false,
                        detectSessionInUrl: false
                    }
                }
            );


            await userSupabase.auth.signOut({
                scope: "local"
            });

        }


        res.clearCookie("access_token");

        res.redirect("/login");

    } catch (error) {

        console.error(error);

        res.clearCookie("access_token");

        res.redirect("/login");
    }

});


// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {

    console.log(`Server running at http://localhost:${PORT}`);

});