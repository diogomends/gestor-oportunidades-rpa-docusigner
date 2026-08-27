import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/**
 * Mongoose schema representing system users and robot service accounts.
 */
const UserSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    senha: {
      type: String,
      required: true,
    },
    cargo: {
      type: String,
      enum: ["admin", "coordenador", "supervisor", "vendedor", "suporte", "robot"],
      default: "robot",
    },
    ativo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compares an entered plain text password against the hashed password stored in the database.
 * @param {string} enteredPassword - Plain text password to check.
 * @returns {Promise<boolean>} True if passwords match, false otherwise.
 */
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.senha);
};

/**
 * User Mongoose model for authentication, authorization, and robot identities.
 * @type {import("mongoose").Model<import("mongoose").Document>}
 */
export const User = mongoose.models.User || mongoose.model("User", UserSchema, "users");
export default User;

