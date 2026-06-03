import '../config/env.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Memory from '../models/Memory.js';
import User from '../models/User.js';

const demoMemories = [
  {
    category: 'personal',
    content: 'Has a daughter named Sarah who lives in Wellington',
    addedBy: 'caregiver',
  },
  {
    category: 'preference',
    content: 'Enjoys gardening and growing roses',
    addedBy: 'caregiver',
  },
  {
    category: 'preference',
    content: 'Favourite music era: 1960s; likes The Beatles',
    addedBy: 'caregiver',
  },
  {
    category: 'preference',
    content: 'Enjoys a cup of Earl Grey in the morning',
    addedBy: 'caregiver',
  },
  {
    category: 'personal',
    content: 'Grew up in Christchurch and moved to Auckland in 1978',
    addedBy: 'caregiver',
  },
];

const upsertDemoUser = async (query, data) =>
  User.findOneAndUpdate(query, { $set: data }, { new: true, upsert: true });

const seedDemo = async () => {
  await connectDB();

  const patient = await upsertDemoUser(
    { name: 'Margaret Thompson', role: 'patient' },
    {
      name: 'Margaret Thompson',
      preferredName: 'Margaret',
      dateOfBirth: new Date('1946-04-18'),
      culturalBackground: 'New Zealand European',
      role: 'patient',
    }
  );

  const caregiver = await upsertDemoUser(
    { name: 'Sarah Thompson', role: 'caregiver' },
    {
      name: 'Sarah Thompson',
      preferredName: 'Sarah',
      role: 'caregiver',
    }
  );

  await User.findByIdAndUpdate(patient._id, { $addToSet: { caregivers: caregiver._id } });
  await User.findByIdAndUpdate(caregiver._id, { $addToSet: { patients: patient._id } });
  await Memory.findOneAndUpdate(
    { userId: patient._id },
    { $set: { entries: demoMemories } },
    { new: true, upsert: true }
  );

  console.log('Demo data ready');
  console.log(`Patient: ${patient.preferredName} (${patient._id})`);
  console.log(`Caregiver: ${caregiver.preferredName} (${caregiver._id})`);
  console.log('');
  console.log('Add this to frontend/.env for a fixed demo profile:');
  console.log(`VITE_DEMO_USER_ID=${patient._id}`);

  await mongoose.disconnect();
};

seedDemo().catch(async (err) => {
  console.error('Failed to seed demo data:', err);
  await mongoose.disconnect();
  process.exit(1);
});
