import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import session from "express-session";
import path from "path";

const db = new Database("timecards.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_id INTEGER,
    name TEXT NOT NULL,
    FOREIGN KEY(year_id) REFERENCES years(id)
  );

  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    name TEXT NOT NULL,
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS professors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    weightage INTEGER DEFAULT 1,
    professor_id INTEGER,
    allowed_class_ids TEXT,
    FOREIGN KEY(professor_id) REFERENCES professors(id)
  );

  CREATE TABLE IF NOT EXISTS classrooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );
`);

// Migration: Add professor_id and allowed_class_ids to subjects if missing
const tableInfo = db.prepare("PRAGMA table_info(subjects)").all();
const hasProfessorId = (tableInfo as any[]).some(col => col.name === 'professor_id');
if (!hasProfessorId) {
  db.exec("ALTER TABLE subjects ADD COLUMN professor_id INTEGER REFERENCES professors(id)");
}
const hasAllowedClassIds = (tableInfo as any[]).some(col => col.name === 'allowed_class_ids');
if (!hasAllowedClassIds) {
  db.exec("ALTER TABLE subjects ADD COLUMN allowed_class_ids TEXT");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS timetable_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER NOT NULL,
    time_slot INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    subject_id INTEGER,
    professor_id INTEGER,
    classroom_id INTEGER,
    exception_flag INTEGER DEFAULT 0,
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(batch_id) REFERENCES batches(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    FOREIGN KEY(professor_id) REFERENCES professors(id),
    FOREIGN KEY(classroom_id) REFERENCES classrooms(id)
  );
`);

// Seed initial data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (id, name) VALUES (?, ?)").run("admin", "Administrator");
  
  const yearResult = db.prepare("INSERT INTO years (name) VALUES (?)").run("Spring 2026");
  const yearId = yearResult.lastInsertRowid;
  
  for (let i = 1; i <= 8; i++) {
    const classResult = db.prepare("INSERT INTO classes (year_id, name) VALUES (?, ?)").run(yearId, `Class ${i}`);
    const classId = classResult.lastInsertRowid;
    const prefix = String.fromCharCode(64 + i); // 1->A, 2->B, etc.
    db.prepare("INSERT INTO batches (class_id, name) VALUES (?, ?)").run(classId, `${prefix}1`);
    db.prepare("INSERT INTO batches (class_id, name) VALUES (?, ?)").run(classId, `${prefix}2`);
    db.prepare("INSERT INTO batches (class_id, name) VALUES (?, ?)").run(classId, `${prefix}3`);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  // One-time update for existing data
  db.prepare("UPDATE years SET name = 'Spring 2026' WHERE name = '2025'").run();
  const classes = db.prepare("SELECT * FROM classes").all();
  for (const cls of classes as any[]) {
    const match = cls.name.match(/Class (\d+)/);
    if (match) {
      const classNum = parseInt(match[1]);
      const prefix = String.fromCharCode(64 + classNum);
      const batches = db.prepare("SELECT * FROM batches WHERE class_id = ?").all(cls.id);
      batches.forEach((b: any, idx: number) => {
        if (b.name === `A${idx + 1}` && prefix !== 'A') {
          db.prepare("UPDATE batches SET name = ? WHERE id = ?").run(`${prefix}${idx + 1}`, b.id);
        }
      });
    }
  }

  app.use(session({
    secret: "timecards-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      sameSite: 'none',
      httpOnly: true
    }
  }));

  // Auth API
  app.post("/api/login", (req, res) => {
    const { userId } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (user) {
      (req.session as any).userId = userId;
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Invalid User ID" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/me", (req, res) => {
    const userId = (req.session as any).userId;
    if (userId) {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
      res.json({ user });
    } else {
      res.json({ user: null });
    }
  });

  // Entities API
  app.get("/api/years", (req, res) => {
    const years = db.prepare("SELECT * FROM years").all();
    res.json(years);
  });

  app.post("/api/years", (req, res) => {
    const { name } = req.body;
    const result = db.prepare("INSERT INTO years (name) VALUES (?)").run(name);
    const yearId = result.lastInsertRowid;
    
    // Create default classes and batches for the new year
    for (let i = 1; i <= 8; i++) {
      const classResult = db.prepare("INSERT INTO classes (year_id, name) VALUES (?, ?)").run(yearId, `Class ${i}`);
      const classId = classResult.lastInsertRowid;
      const prefix = String.fromCharCode(64 + i);
      db.prepare("INSERT INTO batches (class_id, name) VALUES (?, ?)").run(classId, `${prefix}1`);
      db.prepare("INSERT INTO batches (class_id, name) VALUES (?, ?)").run(classId, `${prefix}2`);
      db.prepare("INSERT INTO batches (class_id, name) VALUES (?, ?)").run(classId, `${prefix}3`);
    }
    
    res.json({ id: yearId, name });
  });

  app.get("/api/classes/:yearId", (req, res) => {
    const classes = db.prepare("SELECT * FROM classes WHERE year_id = ?").all(req.params.yearId);
    const classesWithBatches = classes.map((c: any) => ({
      ...c,
      batches: db.prepare("SELECT * FROM batches WHERE class_id = ?").all(c.id)
    }));
    res.json(classesWithBatches);
  });

  app.get("/api/professors", (req, res) => {
    res.json(db.prepare("SELECT * FROM professors").all());
  });

  app.post("/api/professors", (req, res) => {
    const { name } = req.body;
    const result = db.prepare("INSERT INTO professors (name) VALUES (?)").run(name);
    res.json({ id: result.lastInsertRowid, name });
  });

  app.delete("/api/professors/:id", (req, res) => {
    db.prepare("DELETE FROM professors WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/subjects", (req, res) => {
    const subjects = db.prepare("SELECT * FROM subjects").all();
    const parsedSubjects = subjects.map((s: any) => ({
      ...s,
      allowed_class_ids: s.allowed_class_ids ? JSON.parse(s.allowed_class_ids) : []
    }));
    res.json(parsedSubjects);
  });

  app.post("/api/subjects", (req, res) => {
    const { name, weightage, professor_id, allowed_class_ids } = req.body;
    const result = db.prepare("INSERT INTO subjects (name, weightage, professor_id, allowed_class_ids) VALUES (?, ?, ?, ?)").run(name, weightage, professor_id, JSON.stringify(allowed_class_ids || []));
    res.json({ id: result.lastInsertRowid, name, weightage, professor_id, allowed_class_ids });
  });

  app.patch("/api/subjects/:id", (req, res) => {
    const { weightage } = req.body;
    db.prepare("UPDATE subjects SET weightage = ? WHERE id = ?").run(weightage, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/subjects/:id", (req, res) => {
    db.prepare("DELETE FROM subjects WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/classrooms", (req, res) => {
    res.json(db.prepare("SELECT * FROM classrooms").all());
  });

  app.post("/api/classrooms", (req, res) => {
    const { name } = req.body;
    const result = db.prepare("INSERT INTO classrooms (name) VALUES (?)").run(name);
    res.json({ id: result.lastInsertRowid, name });
  });

  app.delete("/api/classrooms/:id", (req, res) => {
    db.prepare("DELETE FROM classrooms WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Timetable API
  app.get("/api/timetable", (req, res) => {
    const entries = db.prepare("SELECT * FROM timetable_entries").all();
    res.json(entries);
  });

  app.post("/api/timetable", (req, res) => {
    const { day, time_slot, class_id, batch_id, subject_id, professor_id, classroom_id, exception_flag } = req.body;
    
    // Check for professor conflict
    if (professor_id && !exception_flag) {
      const conflict = db.prepare(`
        SELECT t.*, c.name as class_name 
        FROM timetable_entries t
        JOIN classes c ON t.class_id = c.id
        WHERE t.day = ? AND t.time_slot = ? AND t.professor_id = ? AND t.class_id != ?
      `).get(day, time_slot, professor_id, class_id);

      if (conflict) {
        return res.status(409).json({ 
          message: `Conflict detected: Professor is already assigned to ${conflict.class_name} at this time.`,
          conflict 
        });
      }
    }

    // Upsert entry
    const existing = db.prepare("SELECT id FROM timetable_entries WHERE day = ? AND time_slot = ? AND class_id = ? AND batch_id = ?")
      .get(day, time_slot, class_id, batch_id);

    if (existing) {
      db.prepare(`
        UPDATE timetable_entries 
        SET subject_id = ?, professor_id = ?, classroom_id = ?, exception_flag = ?
        WHERE id = ?
      `).run(subject_id, professor_id, classroom_id, exception_flag ? 1 : 0, existing.id);
    } else {
      db.prepare(`
        INSERT INTO timetable_entries (day, time_slot, class_id, batch_id, subject_id, professor_id, classroom_id, exception_flag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(day, time_slot, class_id, batch_id, subject_id, professor_id, classroom_id, exception_flag ? 1 : 0);
    }

    res.json({ success: true });
  });

  app.delete("/api/timetable", (req, res) => {
    const { day, time_slot, class_id, batch_id } = req.body;
    db.prepare("DELETE FROM timetable_entries WHERE day = ? AND time_slot = ? AND class_id = ? AND batch_id = ?")
      .run(day, time_slot, class_id, batch_id);
    res.json({ success: true });
  });

  app.post("/api/timetable/bulk", (req, res) => {
    const { entries } = req.body;
    const insert = db.prepare(`
      INSERT INTO timetable_entries (day, time_slot, class_id, batch_id, subject_id, professor_id, classroom_id, exception_flag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = db.transaction((entries) => {
      for (const entry of entries) {
        insert.run(
          entry.day, 
          entry.time_slot, 
          entry.class_id, 
          entry.batch_id, 
          entry.subject_id, 
          entry.professor_id, 
          entry.classroom_id, 
          entry.exception_flag || 0
        );
      }
    });
    
    transaction(entries);
    res.json({ success: true });
  });

  app.post("/api/timetable/clear", (req, res) => {
    const { yearId } = req.body;
    if (yearId) {
      db.prepare(`
        DELETE FROM timetable_entries 
        WHERE class_id IN (SELECT id FROM classes WHERE year_id = ?)
      `).run(yearId);
    } else {
      db.prepare("DELETE FROM timetable_entries").run();
    }
    res.json({ success: true });
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
