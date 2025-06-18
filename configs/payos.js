const PayOS = require('@payos/node');

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

const createPayment = async (paymentData, userId, finalPrice) => {
  const body = {
    orderCode: Number(Date.now()),
    amount: Number(finalPrice),
    description: paymentData.title,
    items: [
      {
        id: paymentData._id,
        name: paymentData.title,
        image: paymentData.imageUrls[0],
        description: paymentData.description,
        quantity: 1,
        price: Number(finalPrice),
        currency: 'VND',
      },
    ],
    returnUrl: `${process.env.PAYOS_RETURN_URL}?documentId=${paymentData._id}&paymentId=${paymentData.paymentId}&userId=${userId}`,
    cancelUrl: `${process.env.PAYOS_RETURN_URL}?documentId=${paymentData._id}&paymentId=${paymentData.paymentId}&userId=${userId}&cancel=true`,
  };
  try {
    const paymentLinkResponse = await payos.createPaymentLink(body);
    return paymentLinkResponse;
  } catch (error) {
    console.error('ERROR createPayment:', error);
    return null;
  }
};

module.exports = { createPayment };
