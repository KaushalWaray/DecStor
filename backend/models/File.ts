
import mongoose, { Schema, Document } from 'mongoose';

// This is the interface for our File document.
// It helps TypeScript understand the shape of our data.
export interface IFile extends Document {
  filename: string;
  cid: string;
  size: number;
  fileType: string;
  owner: string;
  createdAt: Date;
}

// This is the Mongoose Schema.
// It defines the structure, data types, and validation for our 'files' collection.
const FileSchema: Schema = new Schema({
  filename: { type: String, required: true },
  cid: { type: String, required: true, unique: true, index: true },
  size: { type: Number, required: true },
  fileType: { type: String, required: true },
  owner: { type: String, required: true, index: true },
}, {
  timestamps: true // This automatically adds `createdAt` and `updatedAt` fields
});

// Create the Mongoose model from the schema.
// Mongoose will create a 'files' collection in MongoDB based on this model.
export default mongoose.model<IFile>('File', FileSchema);

