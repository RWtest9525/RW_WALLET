const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '4affd7dd-a2c1-4b94-8253-dde142f4c847';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!ONESIGNAL_REST_API_KEY) {
        return res.status(500).json({ error: 'Missing ONESIGNAL_REST_API_KEY environment variable.' });
    }

    try {
        const { title, message, userId, url, data } = req.body || {};

        if (!title || !message) {
            return res.status(400).json({ error: 'Missing title or message.' });
        }

        const payload = {
            app_id: ONESIGNAL_APP_ID,
            target_channel: 'push',
            headings: { en: String(title) },
            contents: { en: String(message) },
            url: url || undefined,
            data: data || {},
        };

        if (userId && userId !== 'all') {
            payload.include_aliases = { external_id: [String(userId)] };
        } else {
            payload.included_segments = ['Subscribed Users'];
        }

        const response = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            return res.status(response.status).json({ error: 'OneSignal send failed.', details: result });
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Notification send failed.' });
    }
};
