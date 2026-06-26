import jwt from "jsonwebtoken";

// Dozvoljava pristup svakom prijavljenom djelatniku (admin ili operator).
export const requireAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Niste prijavljeni." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!["admin", "operator"].includes(decoded.role)) {
      return res.status(403).json({ message: "Nemate ovlasti za ovu radnju." });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Sesija je istekla ili je nevažeća. Prijavite se ponovno.",
    });
  }
};
