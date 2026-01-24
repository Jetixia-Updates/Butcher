
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';

async function run() {
    try {
        // 1. Fetch Orders
        console.log('Fetching orders...');
        const response = await fetch(`${BASE_URL}/orders`);
        const data = await response.json();

        if (!data.success || !data.data || data.data.length === 0) {
            console.log('No orders found.');
            return;
        }

        const order = data.data.find(o => o.status === 'confirmed');
        if (!order) {
            console.log('No confirmed orders found. Using first order found:', data.data[0].id, data.data[0].status);
            // We can try to update even if not confirmed, just to test the mechanism, 
            // or we can create a new order but that's complex.
            // Let's force update the first order to 'processing' if it is not already?
            // Or if it is 'pending', change to 'confirmed' first.
        } else {
            console.log(`Found confirmed order: ${order.id}`);
            // 2. Update Status to processing
            console.log(`Updating order ${order.id} status to 'processing'...`);
            const updateResponse = await fetch(`${BASE_URL}/orders/${order.id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'admin' // simulating admin
                },
                body: JSON.stringify({ status: 'processing', notes: 'Test update' })
            });

            const updateData = await updateResponse.json();
            console.log('Update Response:', JSON.stringify(updateData, null, 2));

            if (updateData.success) {
                console.log('Update Successful!');
            } else {
                console.error('Update Failed!');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
