// src/config/database.js
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

let contractsConnection = null;

export const connectContractsDB = async () => {
  if (contractsConnection) return contractsConnection;
  contractsConnection = mongoose.connection.useDb("crm_contracts", {
    noListener: true,
    useCache: true,
  });
  console.log(`MongoDB Contracts DB 'crm_contracts' ready`);
  return contractsConnection;
};

export const getContractsConnection = () => {
  if (!contractsConnection) {
    contractsConnection = mongoose.connection.useDb("crm_contracts", {
      noListener: true,
      useCache: true,
    });
  }
  return contractsConnection;
};

let aclConnection = null;

export const connectAclDB = async () => {
  if (aclConnection) return aclConnection;
  aclConnection = mongoose.connection.useDb("crm_acl", {
    noListener: true,
    useCache: true,
  });
  console.log(`MongoDB ACL DB 'crm_acl' ready`);
  return aclConnection;
};

export const getAclDb = () => {
  if (!aclConnection) {
    aclConnection = mongoose.connection.useDb("crm_acl", {
      noListener: true,
      useCache: true,
    });
  }
  return aclConnection;
};

export default connectDB;
