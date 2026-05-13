require('dotenv').config();
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    clientX509CertUrl: process.env.FIREBASE_CLIENT_CERT_URL,
  }),
});

const db = admin.firestore();

const USERS = [
  { customerId: '01009', name: 'Rohit Suryavanshi', phone: '+919167371528', email: 'rohit.suryavanshi@email.com', password: 'rohit1528',   membershipTier: 'gold' },
  { customerId: '01021', name: 'Reethu AM',         phone: '+919840856702', email: 'reethu.am@email.com',         password: 'reethu6702',  membershipTier: 'platinum' },
  { customerId: '01001', name: 'Priya Sharma',      phone: '+919876543210', email: 'priya.sharma@email.com',      password: 'priya3210',   membershipTier: 'silver' },
  { customerId: '01002', name: 'Arjun Mehta',       phone: '+919812345678', email: 'arjun.mehta@email.com',       password: 'arjun5678',   membershipTier: 'gold' },
  { customerId: '01003', name: 'Kavya Nair',        phone: '+919988776655', email: 'kavya.nair@email.com',        password: 'kavya6655',   membershipTier: 'platinum' },
  { customerId: '01004', name: 'Rahul Gupta',       phone: '+919123456789', email: 'rahul.gupta@email.com',       password: 'rahul6789',   membershipTier: 'silver' },
  { customerId: '01005', name: 'Ananya Krishnan',   phone: '+919900112233', email: 'ananya.k@email.com',          password: 'ananya2233',  membershipTier: 'gold' },
  { customerId: '01006', name: 'Vikram Patel',      phone: '+919765432109', email: 'vikram.patel@email.com',      password: 'vikram2109',  membershipTier: 'silver' },
  { customerId: '01007', name: 'Sneha Reddy',       phone: '+919654321098', email: 'sneha.reddy@email.com',       password: 'sneha1098',   membershipTier: 'gold' },
  { customerId: '01008', name: 'Aditya Joshi',      phone: '+919543210987', email: 'aditya.joshi@email.com',      password: 'aditya0987',  membershipTier: 'platinum' },
  { customerId: '01010', name: 'Meera Iyer',        phone: '+919432109876', email: 'meera.iyer@email.com',        password: 'meera9876',   membershipTier: 'silver' },
  { customerId: '01011', name: 'Suresh Pillai',     phone: '+919321098765', email: 'suresh.pillai@email.com',     password: 'suresh8765',  membershipTier: 'gold' },
  { customerId: '01012', name: 'Deepika Singh',     phone: '+919210987654', email: 'deepika.singh@email.com',     password: 'deepika7654', membershipTier: 'silver' },
  { customerId: '01013', name: 'Kiran Kumar',       phone: '+919109876543', email: 'kiran.kumar@email.com',       password: 'kiran6543',   membershipTier: 'platinum' },
  { customerId: '01014', name: 'Lakshmi Venkat',    phone: '+919098765432', email: 'lakshmi.v@email.com',         password: 'lakshmi5432', membershipTier: 'silver' },
  { customerId: '01015', name: 'Rajesh Bose',       phone: '+918987654321', email: 'rajesh.bose@email.com',       password: 'rajesh4321',  membershipTier: 'gold' },
  { customerId: '01016', name: 'Pooja Chaudhari',   phone: '+918876543210', email: 'pooja.chaudhari@email.com',   password: 'pooja3210',   membershipTier: 'silver' },
  { customerId: '01017', name: 'Nikhil Desai',      phone: '+918765432109', email: 'nikhil.desai@email.com',      password: 'nikhil2109',  membershipTier: 'gold' },
  { customerId: '01018', name: 'Sunita Rao',        phone: '+918654321098', email: 'sunita.rao@email.com',        password: 'sunita1098',  membershipTier: 'silver' },
  { customerId: '01019', name: 'Mohan Das',         phone: '+918543210987', email: 'mohan.das@email.com',         password: 'mohan0987',   membershipTier: 'platinum' },
  { customerId: '01020', name: 'Geeta Nambiar',     phone: '+918432109876', email: 'geeta.nambiar@email.com',     password: 'geeta9876',   membershipTier: 'silver' },
];

const PRODUCTS = [
  { itemId: 'HW001', name: 'Himalaya Moisturizing Aloe Vera Face Wash', category: 'Face Care',         price: 120, stock: 500, image: 'https://placehold.co/300x300/006644/white?text=Face+Wash',   description: 'Gentle face wash with aloe vera and turmeric.' },
  { itemId: 'HW002', name: 'Himalaya Neem Face Wash',                   category: 'Face Care',         price: 95,  stock: 450, image: 'https://placehold.co/300x300/006644/white?text=Neem+Wash',   description: 'Purifying neem face wash for oily and acne-prone skin.' },
  { itemId: 'HW003', name: 'Himalaya Anti-Dandruff Shampoo',            category: 'Hair Care',         price: 185, stock: 300, image: 'https://placehold.co/300x300/006644/white?text=Shampoo',      description: 'Tea tree and rosemary formulation that fights dandruff.' },
  { itemId: 'HW004', name: 'Himalaya Protein Hair Cream',               category: 'Hair Care',         price: 140, stock: 250, image: 'https://placehold.co/300x300/006644/white?text=Hair+Cream',   description: 'Nourishing protein-enriched hair cream.' },
  { itemId: 'HW005', name: 'Himalaya Cocoa Butter Body Lotion',         category: 'Body Care',         price: 225, stock: 380, image: 'https://placehold.co/300x300/006644/white?text=Body+Lotion',  description: 'Rich cocoa butter lotion for deep moisturisation.' },
  { itemId: 'HW006', name: 'Himalaya Complete Care Toothpaste',         category: 'Oral Care',         price: 85,  stock: 600, image: 'https://placehold.co/300x300/006644/white?text=Toothpaste',   description: 'Herbal toothpaste with neem and pomegranate.' },
  { itemId: 'HW007', name: 'Himalaya Botanique Whitening Toothpaste',   category: 'Oral Care',         price: 130, stock: 420, image: 'https://placehold.co/300x300/006644/white?text=White+Paste',  description: 'Natural whitening toothpaste without harsh chemicals.' },
  { itemId: 'HW008', name: 'Himalaya Men Pimple Clear Face Wash',       category: "Men's Care",        price: 110, stock: 350, image: 'https://placehold.co/300x300/006644/white?text=Men+Wash',     description: 'Oil-control pimple-fighting face wash for men.' },
  { itemId: 'HW009', name: 'Himalaya Refreshing Baby Shampoo',          category: 'Baby Care',         price: 195, stock: 280, image: 'https://placehold.co/300x300/006644/white?text=Baby+Shampoo', description: 'Tear-free gentle baby shampoo with chickpea.' },
  { itemId: 'HW010', name: 'Himalaya Baby Powder',                      category: 'Baby Care',         price: 165, stock: 320, image: 'https://placehold.co/300x300/006644/white?text=Baby+Powder',  description: 'Soft talc-free baby powder with natural herbs.' },
  { itemId: 'HW011', name: 'Himalaya Liv.52 DS Tablets 60s',            category: 'General Health',    price: 240, stock: 500, image: 'https://placehold.co/300x300/004466/white?text=Liv.52',        description: 'Liver support supplement. 60 tablets.' },
  { itemId: 'HW012', name: 'Himalaya Ashvagandha Capsules 60s',         category: 'General Health',    price: 299, stock: 450, image: 'https://placehold.co/300x300/004466/white?text=Ashvagandha',   description: 'Pure Ashwagandha for stress relief and vitality.' },
  { itemId: 'HW013', name: 'Himalaya Triphala Tablets 60s',             category: 'General Health',    price: 180, stock: 400, image: 'https://placehold.co/300x300/004466/white?text=Triphala',      description: 'Digestive wellness with the Triphala formula.' },
  { itemId: 'HW014', name: 'Himalaya Diabecon DS Tablets 60s',          category: 'General Health',    price: 310, stock: 250, image: 'https://placehold.co/300x300/004466/white?text=Diabecon',      description: 'Herbal supplement for blood sugar management.' },
  { itemId: 'HW015', name: 'Himalaya Bonnisan Liquid 200ml',            category: "Children's Health", price: 135, stock: 300, image: 'https://placehold.co/300x300/004466/white?text=Bonnisan',     description: 'Digestive tonic for infants and children.' },
  { itemId: 'HW016', name: 'Himalaya Rumalaya Forte Tablets 60s',       category: 'General Health',    price: 275, stock: 350, image: 'https://placehold.co/300x300/004466/white?text=Rumalaya',      description: 'Natural support for joint and bone health.' },
  { itemId: 'HW017', name: 'Himalaya Septilin Tablets 60s',             category: 'General Health',    price: 190, stock: 400, image: 'https://placehold.co/300x300/004466/white?text=Septilin',      description: 'Immunity booster with giloy and guduchi.' },
  { itemId: 'HW018', name: 'Himalaya Pilex Tablets 60s',                category: 'General Health',    price: 220, stock: 280, image: 'https://placehold.co/300x300/004466/white?text=Pilex',         description: 'Herbal remedy for piles relief.' },
  { itemId: 'HW019', name: 'Himalaya Tentex Royal Capsules 10s',        category: "Men's Health",      price: 260, stock: 200, image: 'https://placehold.co/300x300/004466/white?text=Tentex',        description: 'Natural vitality capsules for men.' },
  { itemId: 'HW020', name: 'Himalaya M2-Tone Syrup 200ml',              category: "Women's Health",    price: 185, stock: 250, image: 'https://placehold.co/300x300/004466/white?text=M2-Tone',       description: "Herbal tonic for women's hormonal balance." },
];

async function seed() {
  console.log('Seeding Himalaya Wellness database...\n');
  console.log('Adding users...');
  for (const user of USERS) {
    await db.collection('users').doc(user.phone).set({ ...user, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`  OK ${user.customerId} - ${user.name} | ${user.membershipTier} | pwd: ${user.password}`);
  }
  console.log('\nAdding products...');
  for (const product of PRODUCTS) {
    await db.collection('inventory').doc(product.itemId).set(product);
    console.log(`  OK ${product.itemId} - ${product.name} - Rs.${product.price}`);
  }
  console.log('\nSeeding complete!\n');
  console.log('=== CREDENTIALS ===');
  USERS.forEach(u => console.log(`${u.customerId} | ${u.name.padEnd(20)} | ${u.phone} | pwd: ${u.password} | ${u.membershipTier}`));
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
