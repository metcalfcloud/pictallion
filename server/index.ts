import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { applyViteFix } from "./vite-fix";

// Apply the fix for path-to-regexp issue with * wildcard
applyViteFix();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(`${new Date().toLocaleTimeString()} [express] ${logLine}`);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Logging function
  function log(message: string, source = "express") {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    console.log(`${formattedTime} [${source}] ${message}`);
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite.js");
    await setupVite(app, server);
  } else {
    // Production mode - serve static files
    const path = await import("path");
    const fs = await import("fs");
    
    // Try multiple possible paths for static files
    const possiblePaths = [
      path.resolve(process.cwd(), "public"),
      path.resolve(process.cwd(), "dist", "public"),
      path.resolve(import.meta.dirname, "..", "public"),
      path.resolve(import.meta.dirname, "public")
    ];
    
    let staticPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        staticPath = testPath;
        console.log(`Using static files from: ${staticPath}`);
        break;
      }
    }
    
    if (!staticPath) {
      throw new Error(`Could not find build directory. Tried: ${possiblePaths.join(", ")}`);
    }
    
    app.use(express.static(staticPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.resolve(staticPath!, "index.html"));
    });
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
