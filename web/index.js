import { join } from 'path';
import { readFileSync } from 'fs';
import express from 'express';
import serveStatic from 'serve-static';

import shopify from './shopify.js';
import webhooks from './webhooks.js';
import { PrismaClient } from '@prisma/client';

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);

const STATIC_PATH =
	process.env.NODE_ENV === 'production'
		? `${process.cwd()}/frontend/dist`
		: `${process.cwd()}/frontend/`;

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
	shopify.config.auth.callbackPath,
	shopify.auth.callback(),
	shopify.redirectToShopifyOrAppRoot()
);
app.post(
	shopify.config.webhooks.path,
	// @ts-ignore
	shopify.processWebhooks({ webhookHandlers: webhooks })
);

app.get('/api/retrieve-cart', async (req, res) => {
	const { shop, customerId } = req.query;

	if (!shop) {
		return res.status(400).send({ error: 'Missing shop parameter' });
	}
	console.log(customerId);

	const cart = await prisma.cart.findFirst({ where: { customerId } });
	res.json(cart.productVariantIds);
});

app.post('/api/save-cart', async (req, res) => {
	const { shop } = req.query;
	const { customerId, productVariantIds } = req.body;

	if (!shop) {
		return res.status(400).send({ error: 'Missing shop parameter' });
	}

	if (!Array.isArray(productVariantIds)) {
		return res.status(400).json({ error: 'productVariantIds must be an array.' });
	}

	const existingCart = await prisma.cart.findFirst({
		where: { customerId },
	});

	if (existingCart) {
		await prisma.cart.delete({
			where: { id: existingCart.id },
		});
	}

	const savedCart = await prisma.cart.create({
		data: {
			customerId,
			productVariantIds,
		},
	});

	res.json({ message: 'Cart saved successfully!', cart: savedCart });
});

// All endpoints after this point will require an active session
app.use('/api/*', shopify.validateAuthenticatedSession());

app.use(express.json());

app.use(serveStatic(STATIC_PATH, { index: false }));

app.use('/*', shopify.ensureInstalledOnShop(), async (_req, res) => {
	return res.set('Content-Type', 'text/html').send(readFileSync(join(STATIC_PATH, 'index.html')));
});

app.listen(PORT);
