import {
	reactExtension,
	Banner,
	BlockSpacer,
	Checkbox,
	Text,
	Button,
	useApi,
	useCustomer,
} from '@shopify/ui-extensions-react/checkout';
import { useState, useCallback } from 'react';

export default reactExtension('purchase.checkout.block.render', () => <Extension />);

function Extension() {
	const [selectedVariantIds, setSelectedVariantIds] = useState([]);
	const [error, setError] = useState(false);
	const [cart, setCart] = useState();
	const customer = useCustomer();
	const { lines, extension, shop } = useApi();

	const customerId = customer?.id.split('/').pop();
	const cartLines = lines?.current;
	const fullURL = extension.scriptUrl;
	const baseURL = new URL(fullURL).origin;

	const handleCheckboxChange = useCallback((checked, variantId) => {
		if (checked) {
			setSelectedVariantIds((prevState) => [...prevState, variantId]);
		} else {
			setSelectedVariantIds((prevState) => prevState.filter((id) => id !== variantId));
		}
	}, []);

	const handleSaveCart = async () => {
		setError(false);
		setCart(undefined);
		try {
			const response = await fetch(`${baseURL}/api/save-cart?shop=${shop.name}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						customerId,
						productVariantIds: selectedVariantIds,
					}),
				}
			);
			if (!response.ok) {
				throw new Error('Failed to save cart');
			}
			const result = await response.json();
			setCart(result.cart);
			console.log('Cart saved:', result);
		} catch (err) {
			console.error('Error:', err);
			setError(true);
		}
	};

	return (
		<Banner
			status={customer ? 'info' : 'warning'}
			title={customer ? 'Save your cart' : 'Please log in to save your cart'}
		>
			{cartLines.map((line) => (
				<>
					<Checkbox
						checked={selectedVariantIds.includes(line.merchandise.id)}
						onChange={(checked) => handleCheckboxChange(checked, line.merchandise.id)}
					>
						{line.merchandise.title}
					</Checkbox>
					<BlockSpacer spacing="base" />
				</>
			))}
			{error && (
				<Text appearance='critical' size="medium">Oops, something went wrong...</Text>
			)}
			{cart && (
				<Text appearance='success' size="medium">Cart successfully saved!</Text>
			)}
			{!error && !cart && (
				<Button disabled={!customer || !selectedVariantIds.length} onPress={handleSaveCart}>
					Save
				</Button>
			)}
		</Banner>
	);
}
