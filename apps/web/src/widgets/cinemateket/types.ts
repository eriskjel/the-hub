export type FilmShowing = {
    title: string;
    director: string | null;
    year: number | null;
    showTime: string; // ISO datetime
    ticketUrl: string | null;
    filmUrl: string | null;
    organizer: string | null;
};
