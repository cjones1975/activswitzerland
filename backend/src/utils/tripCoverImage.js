import axios from 'axios';

// Only ever the first activity added, and only when it's an attraction (hikes/bikes have no
// photo data — see explore-trips-cover-image-spec.md's "Confirmed decisions"). Never falls back
// to a later activity.
export const resolveCoverImage = async (activities) => {
    const first = activities?.[0];
    if (!first || first.kind !== 'attraction') return null;

    try {
        const response = await axios({
            method: 'get',
            url: `${process.env.MYS_ENDPOINT}/v1/attractions/${first.refId}?lang=en&expand=true&striphtml=false`,
            headers: {
                'x-api-key': process.env.MYS_KEY,
                accept: 'application/json',
            },
        });
        return response.data?.image?.[0]?.url ?? null;
    } catch (err) {
        // A missing cover photo must never block saving a trip.
        console.error('resolveCoverImage: MySwitzerland lookup failed', err.message);
        return null;
    }
};
