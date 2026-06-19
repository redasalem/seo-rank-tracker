import Stripe from "stripe";
import User from "../models/User.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock"); // fallback for dev without keys

// @desc    Create Stripe Checkout Session for Pro plan
// @route   POST /api/subscription/create-checkout-session
// @access  Private
export const createCheckoutSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

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
                            name: "Rank Pilot Pro Plan",
                            description: "Unlimited SEO analyses and keyword tracking.",
                        },
                        unit_amount: 1999, // $19.99 per month
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
        // Fallback for local testing without webhook secret
        event = req.body;
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const userId = session.client_reference_id;
                const customerId = session.customer;
                const subscriptionId = session.subscription;

                if (userId) {
                    await User.findByIdAndUpdate(userId, {
                        plan: "pro",
                        stripeCustomerId: customerId,
                        stripeSubscriptionId: subscriptionId,
                    });
                    console.log(`✅ User ${userId} upgraded to PRO`);
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

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Webhook processing error:", error);
        res.status(500).send("Webhook processing failed");
    }
};
