const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs'); 
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const morgan = require("morgan");
const helmet = require("helmet");

const lookupRoutes = require("./routes/lookup.routes.js");
const caseroutes = require('./routes/case.routes.js');
const userRoutes = require('./routes/user.routes.js');
const authRoutes = require("./routes/auth.routes");


const port = 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));

// โหลด Swagger
const swaggerPath = path.resolve(__dirname, 'config', 'swagger.yaml');
const swaggerDocument = YAML.parse(fs.readFileSync(swaggerPath, 'utf8'));


app.use('/', caseroutes);
app.use('/accounts', userRoutes);
app.use("/lookup", lookupRoutes);
app.use("/login", authRoutes);


// Root route
app.get("/", (req, res) => {
  res.send("🚀 Server is running!");
});

// เสิร์ฟ Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(port, () => {
    console.log(`✅ REST & Swagger at http://localhost:${port}/api-docs`);
});
