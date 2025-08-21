export type Deal = {
    name: string;
    store: string;
    price: number;
    unitPrice?: number;
    unit?: string;
    validFrom?: string;
    validUntil?: string;
    image?: string;
    storeLogo?: string;
};
