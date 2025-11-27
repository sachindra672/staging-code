import Razorpay from 'razorpay';
import { Request, Response } from 'express';

const razorpay = new Razorpay({
    key_id: 'rzp_test_CLHOBmmGzZrlCL',
    key_secret: 'BPtQ7Wo7JUOQZCyeaLjRihqW',
});

export async function createOrder(req: Request, res: Response) {
    const options = req.body

    try {
        const order = await razorpay.orders.create(options);
        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating Razorpay order');
    }
}


