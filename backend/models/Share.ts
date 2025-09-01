
import mongoose, { Schema, Document } from 'mongoose';

export interface IShare extends Document {
  cid: string;
  ownerAddress: string;
  recipientAddress: string;
  createdAt: Date;
}

const ShareSchema: Schema = new Schema({
  cid: { type: String, required: true, index: true },
  ownerAddress: { type: String, required: true, index: true },
  recipientAddress: { type: String, required: true, index: true },
}, {
  timestamps: true
});

// Ensure a user can only have a file shared with them once
ShareSchema.index({ cid: 1, recipientAddress: 1 }, { unique: true });

export default mongoose.model<IShare>('Share', ShareSchema);
