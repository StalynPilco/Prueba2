import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("candy_store.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    category TEXT,
    image TEXT,
    code TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    total REAL NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_name TEXT,
    customer_id TEXT,
    customer_type TEXT DEFAULT 'Consumidor Final',
    payment_method TEXT DEFAULT 'Efectivo'
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price_at_sale REAL,
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );
`);

// Ensure columns exist for older databases
try { db.exec("ALTER TABLE products ADD COLUMN image TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE products ADD COLUMN code TEXT"); } catch (e) {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON products(code)"); } catch (e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN tax REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN customer_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN customer_type TEXT DEFAULT 'Consumidor Final'"); } catch (e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'Efectivo'"); } catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  // Products
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { name, price, stock, category, image, code } = req.body;
    try {
      const info = db.prepare("INSERT INTO products (name, price, stock, category, image, code) VALUES (?, ?, ?, ?, ?, ?)").run(name, price, stock, category, image, code);
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/products/:id", (req, res) => {
    const { name, price, stock, category, image, code } = req.body;
    try {
      db.prepare("UPDATE products SET name = ?, price = ?, stock = ?, category = ?, image = ?, code = ? WHERE id = ?").run(name, price, stock, category, image, code, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Sales
  app.get("/api/sales", (req, res) => {
    const sales = db.prepare(`
      SELECT s.*, GROUP_CONCAT(p.name || ' (x' || si.quantity || ')') as items
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      GROUP BY s.id
      ORDER BY s.date DESC
    `).all();
    res.json(sales);
  });

  app.post("/api/sales", (req, res) => {
    const { subtotal, tax, total, customer_name, customer_id, customer_type, payment_method, items } = req.body;
    
    const transaction = db.transaction(() => {
      const saleInfo = db.prepare(`
        INSERT INTO sales (subtotal, tax, total, customer_name, customer_id, customer_type, payment_method) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(subtotal, tax, total, customer_name, customer_id, customer_type, payment_method);
      
      const saleId = saleInfo.lastInsertRowid;

      for (const item of items) {
        db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)")
          .run(saleId, item.product_id, item.quantity, item.price);
        
        // Update stock
        db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.quantity, item.product_id);
      }
      return saleId;
    });

    try {
      const saleId = transaction();
      res.json({ id: saleId });
    } catch (error: any) {
      console.error("Error en transacción de venta:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
