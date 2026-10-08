import { doc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Product, Company, Contact, Lead, FollowUp } from '../types/crm';

export const INITIAL_YALIX_PRODUCTS: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { productId: 'prod_egg_shell', name: 'Egg Shell Powder', category: 'Biomaterials', unit: 'Metric Tons', description: 'High calcium bio-derived mineral powder for industrial and pharmaceutical applications', active: true },
  { productId: 'prod_egg_membrane', name: 'Egg Membrane Powder', category: 'Nutraceuticals', unit: 'Kilograms', description: 'Rich in natural collagen, hyaluronic acid, and glycosaminoglycans', active: true },
  { productId: 'prod_organic_seeds', name: 'Organic Seeds', category: 'Agro Products', unit: 'Metric Tons', description: 'Certified organic mixed seed varieties for health food processors', active: true },
  { productId: 'prod_pumpkin_seeds', name: 'Pumpkin Seeds', category: 'Agro Products', unit: 'Metric Tons', description: 'Grade-A dried pumpkin seeds with high zinc and magnesium content', active: true },
  { productId: 'prod_sesame_seeds', name: 'Sesame Seeds', category: 'Agro Products', unit: 'Metric Tons', description: 'Natural white and hulled sesame seeds for export', active: true },
  { productId: 'prod_sunflower_seeds', name: 'Sunflower Seeds', category: 'Agro Products', unit: 'Metric Tons', description: 'Confectionery and oilseed grade sunflower seeds', active: true },
  { productId: 'prod_cardamom', name: 'Cardamom', category: 'Spices', unit: 'Kilograms', description: 'Green cardamom pods premium export grade', active: true },
  { productId: 'prod_dry_leaves', name: 'Dry Leaves', category: 'Botanicals', unit: 'Bales', description: 'Cured natural dry leaves for industrial extraction and aroma', active: true },
  { productId: 'prod_wet_leaves', name: 'Wet Leaves', category: 'Botanicals', unit: 'Barrels', description: 'Freshly harvested preserved wet leaves for essential oil distillation', active: true },
  { productId: 'prod_palm_jaggery', name: 'Palm Jaggery', category: 'Natural Sweeteners', unit: 'Metric Tons', description: 'Pure artisanal palm jaggery blocks without chemical bleaching', active: true },
  { productId: 'prod_glass_powder', name: 'Glass Powder', category: 'Industrial Minerals', unit: 'Metric Tons', description: 'Superfine micro-milled silica glass powder for composites and abrasives', active: true },
];

export async function ensureYalixProducts(userId: string): Promise<number> {
  const productsSnap = await getDocs(collection(db, 'products'));
  const now = new Date().toISOString();
  let addedCount = 0;

  const batch = writeBatch(db);
  const existingNames = new Set(productsSnap.docs.map((d) => (d.data() as Product).name.toLowerCase()));

  for (const item of INITIAL_YALIX_PRODUCTS) {
    if (!existingNames.has(item.name.toLowerCase())) {
      const docRef = doc(db, 'products', item.productId);
      const productDoc: Product = {
        ...item,
        id: item.productId,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(docRef, productDoc);
      addedCount++;
    }
  }

  if (addedCount > 0) {
    await batch.commit();
  }
  return addedCount;
}

export async function seedSampleCRMData(userId: string): Promise<void> {
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const batch = writeBatch(db);

  // Sample Companies
  const c1: Company = {
    id: 'comp_nutra_nordic',
    companyId: 'comp_nutra_nordic',
    companyName: 'NutraNordic Bioactives AB',
    website: 'https://nutranordic.example.com',
    country: 'Sweden',
    state: 'Stockholm',
    city: 'Stockholm',
    address: 'Hammarby Backe 4, 120 30',
    industry: 'Nutraceuticals & Dietary Supplements',
    companySize: '50-200',
    revenue: '$15M - $25M',
    linkedinUrl: 'https://linkedin.com/company/nutranordic-example',
    source: 'B2B Trade Directory',
    status: 'ACTIVE_PROSPECT',
    notes: 'Inquiring about bulk Egg Membrane Powder for joint care capsule formulations.',
    createdAt: now,
    updatedAt: now,
  };

  const c2: Company = {
    id: 'comp_agri_bavaria',
    companyId: 'comp_agri_bavaria',
    companyName: 'Bavarian Organics GmbH',
    website: 'https://bavarianorganics.example.de',
    country: 'Germany',
    state: 'Bavaria',
    city: 'Munich',
    address: 'Industriestrasse 18, 80331',
    industry: 'Food & Beverage Ingredients',
    companySize: '200-500',
    revenue: '$45M',
    linkedinUrl: 'https://linkedin.com/company/bavarian-organics',
    source: 'BioFach Trade Fair',
    status: 'VERIFIED_LEAD',
    notes: 'Regular importer of Sesame Seeds and Organic Pumpkin Seeds.',
    createdAt: now,
    updatedAt: now,
  };

  const c3: Company = {
    id: 'comp_apex_composites',
    companyId: 'comp_apex_composites',
    companyName: 'Apex Composite Solutions LLC',
    website: 'https://apexcomposites.example.com',
    country: 'United States',
    state: 'Ohio',
    city: 'Akron',
    address: '900 Innovation Pkwy',
    industry: 'Industrial Materials & Polymers',
    companySize: '100-250',
    revenue: '$30M',
    linkedinUrl: 'https://linkedin.com/company/apex-composites',
    source: 'Website Form',
    status: 'ACTIVE_PROSPECT',
    notes: 'Requires 400 mesh fine Glass Powder as resin filler.',
    createdAt: now,
    updatedAt: now,
  };

  batch.set(doc(db, 'companies', c1.companyId), c1);
  batch.set(doc(db, 'companies', c2.companyId), c2);
  batch.set(doc(db, 'companies', c3.companyId), c3);

  // Sample Contacts
  const cnt1: Contact = {
    id: 'cnt_elena_lindqvist',
    contactId: 'cnt_elena_lindqvist',
    companyId: c1.companyId,
    companyName: c1.companyName,
    firstName: 'Elena',
    lastName: 'Lindqvist',
    jobTitle: 'Head of Procurement',
    department: 'Sourcing & Quality',
    businessEmail: 'elena.lindqvist@nutranordic.example.se',
    phone: '+46 8 123 4567',
    country: 'Sweden',
    source: 'Trade Event',
    emailStatus: 'VALID',
    contactStatus: 'ACTIVE',
    lastContactedAt: now,
    notes: 'Requested technical specification sheet and heavy metal testing report.',
    createdAt: now,
    updatedAt: now,
  };

  const cnt2: Contact = {
    id: 'cnt_hans_mueller',
    contactId: 'cnt_hans_mueller',
    companyId: c2.companyId,
    companyName: c2.companyName,
    firstName: 'Hans',
    lastName: 'Mueller',
    jobTitle: 'Senior Purchasing Manager',
    department: 'Raw Materials Supply',
    businessEmail: 'h.mueller@bavarianorganics.example.de',
    phone: '+49 89 9876543',
    country: 'Germany',
    source: 'BioFach Trade Fair',
    emailStatus: 'VALID',
    contactStatus: 'ACTIVE',
    lastContactedAt: yesterdayStr,
    notes: 'Wants container load quotation for sesame and pumpkin seeds CIF Hamburg.',
    createdAt: now,
    updatedAt: now,
  };

  const cnt3: Contact = {
    id: 'cnt_david_miller',
    contactId: 'cnt_david_miller',
    companyId: c3.companyId,
    companyName: c3.companyName,
    firstName: 'David',
    lastName: 'Miller',
    jobTitle: 'Materials R&D Lead',
    department: 'Engineering',
    businessEmail: 'dmiller@apexcomposites.example.com',
    phone: '+1 330 555 0192',
    country: 'United States',
    source: 'Website Form',
    emailStatus: 'VALID',
    contactStatus: 'ACTIVE',
    notes: 'Requires 500g sample of Glass Powder for test compounding.',
    createdAt: now,
    updatedAt: now,
  };

  batch.set(doc(db, 'contacts', cnt1.contactId), cnt1);
  batch.set(doc(db, 'contacts', cnt2.contactId), cnt2);
  batch.set(doc(db, 'contacts', cnt3.contactId), cnt3);

  // Sample Leads
  const l1: Lead = {
    id: 'lead_mem_nordic',
    leadId: 'lead_mem_nordic',
    companyId: c1.companyId,
    companyName: c1.companyName,
    contactId: cnt1.contactId,
    contactName: 'Elena Lindqvist',
    contactEmail: cnt1.businessEmail,
    productInterest: 'Egg Membrane Powder',
    leadSource: 'Trade Event',
    leadStatus: 'INTERESTED',
    priority: 'HIGH',
    assignedTo: 'YALIX Sales Team',
    nextFollowUpAt: todayStr,
    notes: 'Sample dispatched via courier. Follow up for receipt and lab feedback.',
    createdAt: now,
    updatedAt: now,
  };

  const l2: Lead = {
    id: 'lead_seeds_bavaria',
    leadId: 'lead_seeds_bavaria',
    companyId: c2.companyId,
    companyName: c2.companyName,
    contactId: cnt2.contactId,
    contactName: 'Hans Mueller',
    contactEmail: cnt2.businessEmail,
    productInterest: 'Sesame Seeds',
    leadSource: 'BioFach Trade Fair',
    leadStatus: 'QUOTATION',
    priority: 'URGENT',
    assignedTo: 'YALIX Sales Team',
    nextFollowUpAt: tomorrowStr,
    notes: 'Quotation sent for 2x40ft FCL. Awaiting purchase order confirmation.',
    createdAt: now,
    updatedAt: now,
  };

  const l3: Lead = {
    id: 'lead_glass_apex',
    leadId: 'lead_glass_apex',
    companyId: c3.companyId,
    companyName: c3.companyName,
    contactId: cnt3.contactId,
    contactName: 'David Miller',
    contactEmail: cnt3.businessEmail,
    productInterest: 'Glass Powder',
    leadSource: 'Website Form',
    leadStatus: 'RESEARCHED',
    priority: 'MEDIUM',
    assignedTo: 'YALIX Sales Team',
    nextFollowUpAt: yesterdayStr,
    notes: 'Overdue follow-up on sample delivery status.',
    createdAt: now,
    updatedAt: now,
  };

  batch.set(doc(db, 'leads', l1.leadId), l1);
  batch.set(doc(db, 'leads', l2.leadId), l2);
  batch.set(doc(db, 'leads', l3.leadId), l3);

  // Follow-ups (Today, Tomorrow, Overdue)
  const fuToday: FollowUp = {
    id: 'fu_today_sample',
    followUpId: 'fu_today_sample',
    companyId: c1.companyId,
    companyName: c1.companyName,
    contactId: cnt1.contactId,
    contactName: 'Elena Lindqvist',
    leadId: l1.leadId,
    title: 'Call Elena regarding Egg Membrane Powder lab trial status',
    dueDate: todayStr,
    priority: 'HIGH',
    status: 'PENDING',
    assignedTo: 'YALIX Team',
    createdAt: now,
    updatedAt: now,
  };

  const fuOverdue: FollowUp = {
    id: 'fu_overdue_apex',
    followUpId: 'fu_overdue_apex',
    companyId: c3.companyId,
    companyName: c3.companyName,
    contactId: cnt3.contactId,
    contactName: 'David Miller',
    leadId: l3.leadId,
    title: 'Confirm dispatch of Glass Powder sample test batch',
    dueDate: yesterdayStr,
    priority: 'MEDIUM',
    status: 'PENDING',
    assignedTo: 'YALIX Team',
    createdAt: now,
    updatedAt: now,
  };

  const fuTomorrow: FollowUp = {
    id: 'fu_tomorrow_quote',
    followUpId: 'fu_tomorrow_quote',
    companyId: c2.companyId,
    companyName: c2.companyName,
    contactId: cnt2.contactId,
    contactName: 'Hans Mueller',
    leadId: l2.leadId,
    title: 'Follow up on Sesame Seeds container shipping schedule & contract',
    dueDate: tomorrowStr,
    priority: 'URGENT',
    status: 'PENDING',
    assignedTo: 'YALIX Team',
    createdAt: now,
    updatedAt: now,
  };

  batch.set(doc(db, 'followups', fuToday.followUpId), fuToday);
  batch.set(doc(db, 'followups', fuOverdue.followUpId), fuOverdue);
  batch.set(doc(db, 'followups', fuTomorrow.followUpId), fuTomorrow);

  await batch.commit();
}
