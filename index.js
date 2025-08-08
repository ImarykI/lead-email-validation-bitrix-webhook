import express from 'express';
import { handleLeadsFromWebformEmailValidation } from './src/handleLeadsFromWebformEmailValidation';

const app = express();


app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({
        message: "The server is live"
    });

    process.exit(0);
});

app.post('/webhook/lead-handler', async (req, res) => {
   
    await handleLeadsFromWebformEmailValidation(req, res);

    process.exit(0);
});

app.use((req, res) => {
    res.status(404).json({
        message: "Cannot find page"
    });
    process.exit(1);
});

const port = Number(process.env.PORT) || 3005;

app.listen(port, () => {
    console.log("Server is running on port", port);
});