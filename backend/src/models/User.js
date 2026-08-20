import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.senha);
};

export const User = mongoose.models.User || mongoose.model("User", UserSchema, "users");
export default User;
