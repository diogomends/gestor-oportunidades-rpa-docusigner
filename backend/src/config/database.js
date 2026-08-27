// src/config/database.js
import mongoose from "mongoose";

/**
 * Establishes the primary MongoDB connection for the application (db_crm_funil).
 * Exits the process if the connection fails.
 * @returns {Promise<void>}
 */
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

/**
 * Initializes and caches the MongoDB connection for the contracts database ('crm_contracts').
 * @returns {Promise<import("mongoose").Connection>} The Mongoose connection instance for crm_contracts.
 */
export const connectContractsDB = async () => {
  if (contractsConnection) return contractsConnection;
  contractsConnection = mongoose.connection.useDb("crm_contracts", {
    noListener: true,
    useCache: true,
  });
  console.log(`MongoDB Contracts DB 'crm_contracts' ready`);
  return contractsConnection;
};

/**
 * Returns the cached MongoDB connection for the contracts database ('crm_contracts'), initializing if necessary.
 * @returns {import("mongoose").Connection} The Mongoose connection instance for crm_contracts.
 */
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

/**
 * Initializes and caches the MongoDB connection for the ACL database ('crm_acl').
 * @returns {Promise<import("mongoose").Connection>} The Mongoose connection instance for crm_acl.
 */
export const connectAclDB = async () => {
  if (aclConnection) return aclConnection;
  aclConnection = mongoose.connection.useDb("crm_acl", {
    noListener: true,
    useCache: true,
  });
  console.log(`MongoDB ACL DB 'crm_acl' ready`);
  return aclConnection;
};

/**
 * Returns the cached MongoDB connection for the ACL database ('crm_acl'), initializing if necessary.
 * @returns {import("mongoose").Connection} The Mongoose connection instance for crm_acl.
 */
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

