import axios from 'axios';

// The first *attraction* activity anywhere in the list, in order — hikes/bikes have no photo
// data (see explore-trips-cover-image-spec.md's "Confirmed decisions"), so a hike/bike-first trip
// falls through to whatever attraction comes next rather than showing no image. A trip with no
// attraction activities at all still shows no image.
export const resolveCoverImage = async (activities) => {
    const first = activities?.find(a => a.kind === 'attraction');
    if (!first) return null;

    try {
        const response = await axios({
            method: 'get',
            url: `${process.env.MYS_ENDPOINT}/v1/attractions/${first.refId}?lang=en&expand=true&striphtml=false`,
            headers: {
                'x-api-key': process.env.MYS_KEY,
                accept: 'application/json',
            },
        });
        // MySwitzerland wraps the actual record under `data.data` ({ meta, links, data }) — same
        // double-unwrap the frontend's own AttractionsService.getAttraction relies on (`res.data.data`).
        return response.data?.data?.image?.[0]?.url ?? null;
    } catch (err) {
        // A missing cover photo must never block saving a trip.
        console.error('resolveCoverImage: MySwitzerland lookup failed', err.message);
        return null;
    }
};
