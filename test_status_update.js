
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

        // Find confirmed order
        let order = data.data.find(o => o.status === 'confirmed');

        if (order) {
            console.log(`Found confirmed order: ${order.id}`);
        } else {
            console.log('No confirmed orders found.');
            // Try pending
            order = data.data.find(o => o.status === 'pending');
            if (order) {
                console.log(`Found pending order: ${order.id}, trying to confirm it first.`);
                const confirmRes = await fetch(`${BASE_URL}/orders/${order.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' },
                    body: JSON.stringify({ status: 'confirmed', notes: 'Auto confirm' })
                });
                const confirmData = await confirmRes.json();
                if (confirmData.success) {
                    console.log('Order confirmed.');
                    order = confirmData.data;
                } else {
                    console.error('Failed to confirm order:', confirmData);
                    return;
                }
            } else {
                console.log('No pending orders either. Using first order:', data.data[0].id, data.data[0].status);
                order = data.data[0];
            }
        }

        // 2. Update Status to processing
        console.log(`Updating order ${order.id} status to 'processing'...`);
        const updateResponse = await fetch(`${BASE_URL}/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': 'admin'
            },
            body: JSON.stringify({ status: 'processing', notes: 'Test update' })
        });

        // Check if response is JSON
        const contentType = updateResponse.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const updateData = await updateResponse.json();
            console.log('Update Response:', JSON.stringify(updateData, null, 2));

            if (updateData.success) {
                console.log('Update Successful!');
            } else {
                console.error('Update Failed!');
            }
        } else {
            const text = await updateResponse.text();
            console.log('Update Response (Text):', text);
        }


    } catch (error) {
        if (error.cause) {
            console.error('Error Cause:', error.cause);
        }
        console.error('Error:', error);
    }
}

run();
