import Stripe from "stripe";
import User from "../models/User.js";
import { sendInvoiceEmail } from "../utils/emailService.js";

let stripe;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
    console.warn("⚠️ STRIPE_SECRET_KEY is not defined. Payments and subscriptions will not work.");
}

// @desc    Create Stripe Checkout Session for Pro plan
// @route   POST /api/subscription/create-checkout-session
// @access  Private
export const createCheckoutSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!stripe) {
            return res.status(500).json({ success: false, message: "Payment service is not configured. Please contact support." });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.plan === "pro") {
            return res.status(400).json({ success: false, message: "You are already on the Pro plan!" });
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            customer_email: user.email,
            client_reference_id: userId,
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "RankBoost Pro Plan",
                            description: "Unlimited SEO analyses and keyword tracking.",
                        },
                        unit_amount: 300, // $3.00 per month
                        recurring: {
                            interval: "month",
                        },
                    },
                    quantity: 1,
                },
            ],
            success_url: `${frontendUrl}/settings?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/settings?canceled=true`,
        });

        res.status(200).json({
            success: true,
            url: session.url,
        });
    } catch (error) {
        console.error("Error creating checkout session:", error);
        res.status(500).json({ success: false, message: "Failed to create checkout session" });
    }
};

// @desc    Handle Stripe Webhooks
// @route   POST /api/subscription/webhook
// @access  Public
export const stripeWebhook = async (req, res) => {
    const payload = req.body;
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    if (endpointSecret) {
        try {
            event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
        } catch (err) {
            console.error("Webhook signature verification failed:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        console.error("⚠️ STRIPE_WEBHOOK_SECRET is not configured. Rejecting webhook.");
        return res.status(500).json({ error: "Webhook secret not configured" });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const userId = session.client_reference_id;
                const customerId = session.customer;
                const subscriptionId = session.subscription;

                if (userId) {
                    const user = await User.findByIdAndUpdate(userId, {
                        plan: "pro",
                        stripeCustomerId: customerId,
                        stripeSubscriptionId: subscriptionId,
                    }, { new: true });
                    console.log(`✅ User ${userId} upgraded to PRO`);

                    if (user && user.email) {
                        const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
                        sendInvoiceEmail(user.email, user.name, "$3.00", date, "Pro").catch(err => {
                            console.error("Failed to send invoice email:", err);
                        });
                    }
                }
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                await User.findOneAndUpdate(
                    { stripeCustomerId: customerId },
                    { plan: "free", stripeSubscriptionId: null }
                );
                console.log(`❌ Customer ${customerId} downgraded to FREE`);
                break;
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object;
                const customerId = invoice.customer;

                await User.findOneAndUpdate(
                    { stripeCustomerId: customerId },
                    { plan: "free", stripeSubscriptionId: null }
                );
                console.log(`❌ Payment failed for ${customerId}. Downgraded to FREE`);
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Webhook processing error:", error);
        res.status(500).send("Webhook processing failed");
    }
};

// @desc    Create Stripe Customer Portal Session
// @route   POST /api/subscription/create-portal-session
// @access  Private
export const createPortalSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!stripe) {
            return res.status(500).json({ success: false, message: "Payment service is not configured." });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!user.stripeCustomerId) {
            return res.status(400).json({ success: false, message: "No billing information found for this account." });
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

        const session = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: `${frontendUrl}/settings?tab=subscription`,
        });

        res.status(200).json({ success: true, url: session.url });
    } catch (error) {
        console.error("Error creating portal session:", error);
        res.status(500).json({ success: false, message: "Failed to create billing portal session" });
    }
};
