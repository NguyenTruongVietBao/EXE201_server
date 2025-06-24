const PayOS = require('@payos/node');

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

const createPayment = async (paymentData, user, finalPrice) => {
  const body = {
    orderCode: Number(String(new Date().getTime()).slice(-6)),
    amount: Number(finalPrice),
    description: 'Thanh toán tài liệu',
    buyerName: user.name,
    buyerEmail: user.email,
    buyerPhone: user.phone,
    items: [
      {
        id: paymentData._id,
        name: paymentData.title,
        quantity: 1,
        price: Number(finalPrice),
      },
    ],
    returnUrl: `${process.env.PAYOS_RETURN_URL}?documentId=${paymentData._id}&paymentId=${paymentData.paymentId}&userId=${user._id}`,
    cancelUrl: `${process.env.PAYOS_RETURN_URL}?documentId=${paymentData._id}&paymentId=${paymentData.paymentId}&userId=${user._id}&cancel=true`,
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
