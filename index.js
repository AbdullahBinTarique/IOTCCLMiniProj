const express = require('express');
const sql = require('mssql');
const { poolPromise } = require('./db');
const app = express();
// Only allow requests from frontend EC2
const allowedIP = ['172.31.31.126', '::1', 'localhost']; // <-- replace with your frontend EC2 IP
app.use((req, res, next) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (clientIP.includes(allowedIP)) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied' });
    }
});

const ports = 3000;
// SQL Server config
const config = {
    user: 'admin',
    password: 'Abdul1101',
    server: 'iotccl.clw80w48eyrn.us-east-1.rds.amazonaws.com',
    database: 'Sensor Data',
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};


// Middleware to parse JSON
app.use(express.json());

// Sample route
app.post('/api/data', (req, res) => {
    console.log('Received data:', req.body);
    res.json({ message: 'Data received' });
});

app.get('/', (req, res) => {
    res.send('This is our HomePage')
})






//API to send sensor data to the front end
app.get('/api/sensordata',)

// API to receive sensor data and store in DB
app.post('/api/sensor', async (req, res) => {
    const { temperature, humidity, vibration_detected } = req.body;

    try {
        await sql.connect(config);

        const query = `
      INSERT INTO SData (temperature, humidity, vibration_detected)
      VALUES (@temperature, @humidity, @vibration_detected)
    `;

        const request = new sql.Request();
        request.input('temperature', sql.Float, temperature);
        request.input('humidity', sql.Float, humidity);
        request.input('vibration_detected', sql.Bit, vibration_detected ? 1 : 0);

        await request.query(query);

        res.json({ message: 'Sensor data inserted successfully!' });
    } catch (err) {
        console.error('Error inserting sensor data:', err);
        res.status(500).json({ error: 'Failed to insert sensor data' });
    }
});

app.listen(ports, () => {
    console.log(`Server running on http://localhost:${ports}`);
});

app.post('/api/inventory', async (req, res) => {
    const { prod_id, prod_count } = req.body;

    try {
        await sql.connect(config);

        const query = `
        MERGE Inventory AS target
        USING (SELECT @prod_id AS prod_id, @prod_count AS prod_count) AS source
        ON target.prod_id = source.prod_id
        WHEN MATCHED THEN 
          UPDATE SET prod_count = source.prod_count
        WHEN NOT MATCHED THEN
          INSERT (prod_id, prod_count)
          VALUES (source.prod_id, source.prod_count);
      `;

        const request = new sql.Request();
        request.input('prod_id', sql.VarChar(10), prod_id);
        request.input('prod_count', sql.Int, prod_count);

        await request.query(query);

        res.json({ message: 'Inventory updated successfully!' });
    } catch (err) {
        console.error('Error updating inventory:', err);
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});


app.get('/api/sensordata', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .query('SELECT TOP 1 temperature, humidity, vibration_detected FROM SData ORDER BY id DESC');

        const row = result.recordset[0];
        res.json({
            temperature: row.temperature,
            humidity: row.humidity,
            vibration_detected: row.vibration_detected
        });
    } catch (err) {
        console.error('Error fetching sensor data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/inventory', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .query('SELECT prod_id, prod_count FROM [Inventory]');

        res.json(result.recordset); // Sends array of product rows
    } catch (err) {
        console.error('Error fetching inventory:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});