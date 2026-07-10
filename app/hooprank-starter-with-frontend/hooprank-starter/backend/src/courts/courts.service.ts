import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Court } from "./court.entity";
import { MatchesService } from "../matches/matches.service";
import { UsersService } from "../users/users.service";
import { DbDialect } from "../common/db-utils";

const COURT_IMAGE_SEEDS = [
  {
    id: "39bbaf2e-7393-d1d4-e7b8-f90d1e53fadc",
    imageUrl:
      "https://www.bayclubs.com/bc-cdn/w_800/https%3A//cdn.prod.website-files.com/6881e0680b14937cf2a11855/68877a507f22eea742600ad5_BC_Hero_SanFrancisco-300x188.jpg",
    sourceUrl: "https://www.bayclubs.com/amenity/basketball",
    sourceLabel: "Bay Club official image",
  },
  {
    id: "6b1b9162-842e-cb1d-23cc-577999cc3c15",
    imageUrl:
      "https://catholiccharitiessf.org/wp-content/uploads/elementor/thumbs/st-vincents-1-1-q3066x730ugy9jeti3zviomlx7a8rq336guafdvoug.jpg",
    sourceUrl: "https://catholiccharitiessf.org/st-vincents-school-for-boys/",
    sourceLabel: "Catholic Charities official image",
  },
  {
    id: "88f85c04-8e09-3217-1818-6adc818c784b",
    imageUrl:
      "https://www.ci.gladstone.or.us/sites/g/files/vyhlif13701/files/media/publicworks/image/17061/08_25_17_senior_center.jpg",
    sourceUrl:
      "https://www.ci.gladstone.or.us/publicworks/page/city-facilities",
    sourceLabel: "City of Gladstone official venue image",
  },
  {
    id: "9c3e1ca0-6200-281b-5f44-45b774f7b6f1",
    imageUrl:
      "https://bbk12e1-cdn.myschoolcdn.com/612/photo/2015/11/orig_photo319598_3280620.png?w=1920",
    sourceUrl: "https://www.marincatholic.org/about/our-facilities",
    sourceLabel: "Marin Catholic official gym image",
  },
  {
    id: "9d0e8a13-fd3c-39b5-e765-82e765c7a3fd",
    imageUrl:
      "https://www.bayclubs.com/bc-cdn/w_800/https://cdn.prod.website-files.com/6881e0680b14937cf2a11855/6889f2e1a67beafa5961dca2_Marin_Basketball_3.jpg",
    sourceUrl: "https://www.bayclubs.com/clubs/marin",
    sourceLabel: "Bay Club Marin official basketball image",
  },
  {
    id: "b638a8a8-1df2-ec14-a864-6d4d3986e84b",
    imageUrl:
      "https://www.usfca.edu/sites/default/files/styles/3_4_960x1280/public/2025-12/Koret%20Basketball.jpg.jpeg?h=af525af9&itok=YuqiphiX",
    sourceUrl: "https://www.usfca.edu/koret",
    sourceLabel: "USF Koret official image",
  },
  {
    id: "cb4b8982-4f42-8c11-01f6-f46401069022",
    imageUrl:
      "https://www.bellevueclub.com/wp-content/uploads/2019/12/Recreation_basketball.jpg",
    sourceUrl: "https://www.bellevueclub.com/move/recreation/",
    sourceLabel: "Bellevue Club official basketball image",
  },
  {
    id: "d6f0a3f1-8bed-13fa-5d3f-a12dc704cff0",
    imageUrl:
      "https://d2rzw8waxoxhv2.cloudfront.net/facilities/medium/2eda1609585525a9632a/1512329870699-690-66.jpg",
    sourceUrl: "https://facilities.facilitron.com/5970cb8207238f0020f56f2b",
    sourceLabel: "Hamilton gym facility image",
  },
  {
    id: "e72bb902-08f6-4dc0-acc3-fa85a6aa1b10",
    imageUrl:
      "https://www.olyclub.com/wp-content/uploads/2025/12/CC-4-scaled-e1764871526289-1024x685.jpg",
    sourceUrl: "https://www.olyclub.com/public-homepage/guest-info/",
    sourceLabel: "Olympic Club official image",
  },
  {
    id: "ed6afa5f-f077-4868-9e50-8c71b3d703cf",
    imageUrl: "https://www.instagram.com/p/DYbA2F9GSud/media/?size=l",
    sourceUrl: "https://www.instagram.com/p/DYbA2F9GSud/",
    sourceLabel: "Novato Parks open-gym image",
  },
  {
    id: "f65ce342-6b75-7faa-7205-47ea5cc0ba43",
    imageUrl:
      "https://d2rzw8waxoxhv2.cloudfront.net/imagine/medium/mcms94903/1706148769819-834-33.jpg",
    sourceUrl: "https://facilities.facilitron.com/65a97676438e4ad58f9926ea",
    sourceLabel: "Miller Creek facility image",
  },
  {
    id: "fc74ef72-1ad1-0c4d-b7cc-019c010f1e68",
    imageUrl:
      "https://images.ctfassets.net/drib7o8rcbyf/6wnKeePmucptvirOG8mvb/8923cb89403b898d5bb45374d46b6e7e/Equinox_ClubPage_Spaces_DT_ESCSanFran_3200x2133_____7.jpg",
    sourceUrl:
      "https://www.equinox.com/clubs/northern-california/sportsclubsanfrancisco",
    sourceLabel: "Equinox official image",
  },
];

type CourtImageResult = {
  url: string;
  cacheControl: string;
};

type CourtImageBackingInput = {
  courtId: string;
  imageProvider: string;
  imagePlaceId: string;
  imageUrl?: string | null;
  imageSourceUrl?: string | null;
  imageSourceLabel?: string | null;
};

@Injectable()
export class CourtsService implements OnModuleInit {
  private dialect: DbDialect;
  private readonly publicApiBaseUrl = (
    process.env.PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "https://heartfelt-appreciation-production-65f1.up.railway.app"
  ).replace(/\/+$/, "");

  constructor(
    @InjectRepository(Court)
    private courtsRepository: Repository<Court>,
    private readonly matchesService: MatchesService,
    private readonly usersService: UsersService,
    private dataSource: DataSource,
  ) {
    this.dialect = new DbDialect(dataSource);
  }

  async onModuleInit() {
    // Auto-create venue_type and address columns if missing (production has synchronize: false)
    if (this.dialect.isPostgres) {
      try {
        await this.dataSource.query(
          `ALTER TABLE courts ADD COLUMN IF NOT EXISTS venue_type TEXT`,
        );
        await this.dataSource.query(
          `ALTER TABLE courts ADD COLUMN IF NOT EXISTS address TEXT`,
        );
        await this.dataSource.query(
          `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_url TEXT`,
        );
        await this.dataSource.query(
          `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_source_url TEXT`,
        );
        await this.dataSource.query(
          `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_source_label TEXT`,
        );
        await this.dataSource.query(
          `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMP`,
        );
        await this.dataSource.query(
          `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_provider TEXT`,
        );
        await this.dataSource.query(
          `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_place_id TEXT`,
        );
        await this.dataSource.query(
          `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_place_updated_at TIMESTAMP`,
        );
        await this.seedCourtImages();
      } catch (e) {
        console.error("[CourtsService] Failed to add columns:", e.message);
      }
    }
  }

  // Note: Courts are seeded via scripts/seed-courts.ts
  // Run: npx ts-node scripts/seed-courts.ts
  // For production: DATABASE_URL="..." npx ts-node scripts/seed-courts.ts

  async findAll(limit?: number): Promise<Court[]> {
    const safeLimit = typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(1, Math.min(Math.trunc(limit), 5000))
      : undefined;

    // Use raw query to extract lat/lng from PostGIS geog column for production
    if (this.dialect.isPostgres) {
      const limitClause = safeLimit ? "LIMIT $1" : "";
      const courts = await this.dataSource.query(
        `
                SELECT 
                    id, name, city, indoor, rims, source, signature, access, venue_type, address,
                    image_url as "imageUrl",
                    image_source_url as "imageSourceUrl",
                    image_source_label as "imageSourceLabel",
                    image_provider as "imageProvider",
                    image_place_id as "imagePlaceId",
                    ST_Y(geog::geometry) as lat,
                    ST_X(geog::geometry) as lng
                FROM courts
                ORDER BY name ASC
                ${limitClause}
            `,
        safeLimit ? [safeLimit] : [],
      );
      return courts.map((court: any) => this.withResolvedImageUrl(court));
    }

    // SQLite fallback for local development
    const courts = await this.courtsRepository.find({
      order: { name: "ASC" },
      take: safeLimit,
    });
    return courts.map((court: any) => this.withResolvedImageUrl(court));
  }

  async findById(id: string): Promise<Court | undefined> {
    if (this.dialect.isPostgres) {
      const results = await this.dataSource.query(
        `
                SELECT 
                    id, name, city, indoor, rims, source, signature, access, venue_type, address,
                    image_url as "imageUrl",
                    image_source_url as "imageSourceUrl",
                    image_source_label as "imageSourceLabel",
                    image_provider as "imageProvider",
                    image_place_id as "imagePlaceId",
                    ST_Y(geog::geometry) as lat,
                    ST_X(geog::geometry) as lng
                FROM courts
                WHERE id = $1
            `,
        [id],
      );
      if (results.length === 0) return undefined;
      return this.withResolvedImageUrl({
        ...results[0],
        king: await this.calculateKing(id),
      }) as any;
    }

    const court = await this.courtsRepository.findOne({ where: { id } });
    if (!court) return undefined;
    return this.withResolvedImageUrl({
      ...court,
      king: await this.calculateKing(id),
    }) as any;
  }

  async searchByLocation(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
  ): Promise<Court[]> {
    if (this.dialect.isPostgres) {
      // Use PostGIS spatial query for production
      const courts = await this.dataSource.query(
        `
                SELECT 
	                    id, name, city, indoor, rims, source, signature, access, venue_type, address,
	                    image_url as "imageUrl",
	                    image_source_url as "imageSourceUrl",
	                    image_source_label as "imageSourceLabel",
	                    image_provider as "imageProvider",
	                    image_place_id as "imagePlaceId",
	                    ST_Y(geog::geometry) as lat,
	                    ST_X(geog::geometry) as lng,
	                    (SELECT COUNT(*) FROM user_followed_courts WHERE court_id = courts.id::text) as follower_count
	                FROM courts
	                WHERE geog && ST_MakeEnvelope($1, $2, $3, $4, 4326)
	                ORDER BY name ASC
	                LIMIT 100
            `,
        [minLng, minLat, maxLng, maxLat],
      );
      return courts.map((court: any) => this.withResolvedImageUrl(court));
    }

    // SQLite fallback - use simple bounding box
    return this.courtsRepository
      .createQueryBuilder("court")
      .where("court.lat BETWEEN :latMin AND :latMax", {
        latMin: minLat,
        latMax: maxLat,
      })
      .andWhere("court.lng BETWEEN :lngMin AND :lngMax", {
        lngMin: minLng,
        lngMax: maxLng,
      })
      .orderBy("court.name", "ASC")
      .limit(100)
      .getMany()
      .then((courts) =>
        courts.map((court: any) => this.withResolvedImageUrl(court)),
      );
  }

  async getCourtImage(courtId: string): Promise<CourtImageResult | null> {
    const court = await this.findImageBacking(courtId);
    if (!court) return null;

    const directImageUrl = this.cleanString(court.imageUrl ?? court.image_url);
    if (
      directImageUrl &&
      !this.isGeneratedCourtImageUrl(courtId, directImageUrl)
    ) {
      return { url: directImageUrl, cacheControl: "public, max-age=3600" };
    }

    const provider = this.cleanString(
      court.imageProvider ?? court.image_provider,
    );
    const placeId = this.cleanString(
      court.imagePlaceId ?? court.image_place_id,
    );
    if (provider !== "google_places" || !placeId) return null;

    const photoUri = await this.resolveGooglePlacesPhotoUri(placeId);
    if (!photoUri) return null;
    return { url: photoUri, cacheControl: "no-store" };
  }

  async updateCourtImageBackings(
    images: CourtImageBackingInput[],
  ): Promise<{ received: number; updated: number; skipped: number }> {
    const safeImages = Array.isArray(images) ? images.slice(0, 500) : [];
    let updated = 0;
    let skipped = 0;

    for (const image of safeImages) {
      const courtId = this.cleanString(image?.courtId);
      const provider = this.cleanString(image?.imageProvider);
      const placeId = this.cleanString(image?.imagePlaceId);
      if (!courtId || provider !== "google_places" || !placeId) {
        skipped++;
        continue;
      }

      const result = await this.dataSource.query(
        `
                UPDATE courts
                SET
                    image_provider = $2,
                    image_place_id = $3,
                    image_url = COALESCE(NULLIF(image_url, ''), $4),
                    image_source_url = COALESCE(NULLIF(image_source_url, ''), $5),
                    image_source_label = COALESCE(NULLIF(image_source_label, ''), $6),
                    image_place_updated_at = NOW(),
                    image_updated_at = COALESCE(image_updated_at, NOW())
                WHERE id::text = $1
                  AND NULLIF(image_url, '') IS NULL
                RETURNING id
            `,
        [
          courtId,
          provider,
          placeId,
          this.cleanString(image.imageUrl),
          this.cleanString(image.imageSourceUrl),
          this.cleanString(image.imageSourceLabel) || "Google Maps photo",
        ],
      );

      if (Array.isArray(result) && result.length > 0) {
        updated++;
      } else {
        skipped++;
      }
    }

    return { received: safeImages.length, updated, skipped };
  }

  private async seedCourtImages(): Promise<void> {
    for (const seed of COURT_IMAGE_SEEDS) {
      await this.dataSource.query(
        `
                UPDATE courts
                SET
                    image_url = COALESCE(NULLIF(image_url, ''), $2),
                    image_source_url = COALESCE(NULLIF(image_source_url, ''), $3),
                    image_source_label = COALESCE(NULLIF(image_source_label, ''), $4),
                    image_updated_at = COALESCE(image_updated_at, NOW())
                WHERE id::text = $1
            `,
        [seed.id, seed.imageUrl, seed.sourceUrl, seed.sourceLabel],
      );
    }
  }

  private async findImageBacking(courtId: string): Promise<any | null> {
    if (this.dialect.isPostgres) {
      const rows = await this.dataSource.query(
        `
                SELECT
                    id,
                    image_url as "imageUrl",
                    image_provider as "imageProvider",
                    image_place_id as "imagePlaceId"
                FROM courts
                WHERE id::text = $1
                LIMIT 1
            `,
        [courtId],
      );
      return rows[0] ?? null;
    }

    const rows = await this.dataSource.query(
      `
            SELECT
                id,
                image_url as "imageUrl",
                image_provider as "imageProvider",
                image_place_id as "imagePlaceId"
            FROM courts
            WHERE id = ?
            LIMIT 1
        `,
      [courtId],
    );
    return rows[0] ?? null;
  }

  private withResolvedImageUrl<T extends Record<string, any>>(court: T): T {
    const imageUrl = this.cleanString(court.imageUrl ?? court.image_url);
    const provider = this.cleanString(
      court.imageProvider ?? court.image_provider,
    );
    const placeId = this.cleanString(
      court.imagePlaceId ?? court.image_place_id,
    );

    if (!imageUrl && provider === "google_places" && placeId && court.id) {
      (court as any).imageUrl =
        `${this.publicApiBaseUrl}/courts/${encodeURIComponent(
          court.id.toString(),
        )}/image`;
    }

    if (
      !this.cleanString(court.imageSourceLabel ?? court.image_source_label) &&
      provider === "google_places"
    ) {
      (court as any).imageSourceLabel = "Google Maps photo";
    }

    return court;
  }

  private async resolveGooglePlacesPhotoUri(
    placeId: string,
  ): Promise<string | null> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;

    const detailsRes = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "photos",
        },
      },
    );
    if (!detailsRes.ok) return null;

    const details = await detailsRes.json();
    const photoName = this.cleanString(details?.photos?.[0]?.name);
    if (!photoName) return null;

    const mediaRes = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${encodeURIComponent(
        apiKey,
      )}`,
    );
    if (!mediaRes.ok) return null;

    const media = await mediaRes.json();
    return this.cleanString(media?.photoUri);
  }

  private isGeneratedCourtImageUrl(courtId: string, imageUrl: string): boolean {
    return imageUrl === `${this.publicApiBaseUrl}/courts/${courtId}/image`;
  }

  private cleanString(value: any): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length > 0 ? text : null;
  }

  private async calculateKing(courtId: string): Promise<string | undefined> {
    // This logic needs to be updated to use DB queries instead of in-memory filtering
    // For now, return undefined to avoid breaking
    return undefined;
  }

  // ==================== CHECK-IN METHODS ====================

  async checkIn(userId: string, courtId: string): Promise<any> {
    const d = this.dialect.reset();

    // First check-out from any existing check-ins at other courts
    await this.dataSource.query(
      `
            UPDATE check_ins 
            SET checked_out_at = ${d.now()} 
            WHERE ${d.cast("user_id", "TEXT")} = ${d.param()} AND checked_out_at IS NULL
        `,
      [userId],
    );

    // Create new check-in
    const insertQuery = d.isPostgres
      ? `INSERT INTO check_ins (user_id, court_id, checked_in_at)
               VALUES ($1, $2, NOW())
               RETURNING id, checked_in_at as "checkedInAt"`
      : `INSERT INTO check_ins (user_id, court_id, checked_in_at)
               VALUES (?, ?, datetime('now'))`;

    const result = await this.dataSource.query(insertQuery, [userId, courtId]);

    if (!d.isPostgres) {
      // SQLite doesn't support RETURNING, fetch the inserted record
      const inserted = await this.dataSource.query(
        `SELECT id, checked_in_at as "checkedInAt" FROM check_ins 
                 WHERE user_id = ? AND court_id = ? ORDER BY id DESC LIMIT 1`,
        [userId, courtId],
      );
      return inserted[0];
    }

    return result[0];
  }

  async checkOut(userId: string, courtId: string): Promise<void> {
    const d = this.dialect.reset();
    await this.dataSource.query(
      `
            UPDATE check_ins 
            SET checked_out_at = ${d.now()} 
            WHERE ${d.cast("user_id", "TEXT")} = ${d.param()} 
            AND ${d.cast("court_id", "TEXT")} = ${d.param()} 
            AND checked_out_at IS NULL
        `,
      [userId, courtId],
    );
  }

  async getCourtActivity(
    courtId: string,
    hoursBack: number = 24,
  ): Promise<any[]> {
    const d = this.dialect.reset();
    const query = `
            SELECT 
                ci.id,
                ci.user_id as "userId",
                u.name as "userName",
                u.avatar_url as "userPhotoUrl",
                ci.checked_in_at as "checkedInAt",
                ci.checked_out_at as "checkedOutAt"
            FROM check_ins ci
            LEFT JOIN users u ON ${d.cast("ci.user_id", "TEXT")} = ${d.cast("u.id", "TEXT")}
            WHERE ${d.cast("ci.court_id", "TEXT")} = ${d.param()} 
              AND ci.checked_in_at > ${d.interval(Math.ceil(hoursBack / 24))}
            ORDER BY ci.checked_in_at DESC
            LIMIT 50
        `;
    return this.dataSource.query(query, [courtId]);
  }

  async getActiveCheckIns(courtId: string): Promise<any[]> {
    const d = this.dialect.reset();
    const query = `
            SELECT 
                ci.id,
                ci.user_id as "userId",
                u.name as "userName",
                u.avatar_url as "userPhotoUrl",
                ci.checked_in_at as "checkedInAt"
            FROM check_ins ci
            LEFT JOIN users u ON ${d.cast("ci.user_id", "TEXT")} = ${d.cast("u.id", "TEXT")}
            WHERE ${d.cast("ci.court_id", "TEXT")} = ${d.param()} AND ci.checked_out_at IS NULL
            ORDER BY ci.checked_in_at DESC
        `;
    return this.dataSource.query(query, [courtId]);
  }

  // ==================== FOLLOWERS ("Hearts") ====================

  /**
   * Get users that follow (heart) a court, sorted by global 1v1 rank (best first).
   * Rank is computed from users.hoop_rank via a window function so we can return
   * a HoopRank # even for users outside the top-100 /rankings endpoint.
   */
  async getCourtFollowers(courtId: string, limit: number = 50): Promise<any[]> {
    const d = this.dialect.reset();
    const safeLimit = Math.max(1, Math.min(limit || 50, 200));

    // SQLite doesn't support "NULLS LAST" but does support window functions.
    const rankOrder = d.isPostgres
      ? "hoop_rank DESC NULLS LAST"
      : "(hoop_rank IS NULL) ASC, hoop_rank DESC";

    const query = `
			WITH ranked_users AS (
				SELECT
					id,
					name,
					avatar_url as "photoUrl",
					hoop_rank as "rating",
					ROW_NUMBER() OVER (ORDER BY ${rankOrder}) as "rank"
				FROM users
				WHERE name IS NOT NULL
			)
			SELECT
				ru.id,
				ru.name,
				ru."photoUrl",
				ru."rating",
				ru."rank"
			FROM ranked_users ru
			JOIN user_followed_courts ufc
				ON ${d.cast("ufc.user_id", "TEXT")} = ${d.cast("ru.id", "TEXT")}
			WHERE ${d.cast("ufc.court_id", "TEXT")} = ${d.param()}
			ORDER BY ru."rank" ASC
			LIMIT ${d.param()}
		`;

    return this.dataSource.query(query, [courtId, safeLimit]);
  }

  // ==================== FOLLOWER COUNTS ====================

  async getFollowerCounts(): Promise<{ courtId: string; count: number }[]> {
    const d = this.dialect.reset();
    const query = d.isPostgres
      ? `SELECT court_id as "courtId", COUNT(*) as count FROM user_followed_courts GROUP BY court_id`
      : `SELECT court_id as "courtId", COUNT(*) as count FROM user_followed_courts GROUP BY court_id`;

    const results = await this.dataSource.query(query);
    return results.map((r: any) => ({
      courtId: r.courtId,
      count: parseInt(r.count, 10),
    }));
  }

  // ==================== COURT STATS ====================

  async getCourtStats(courtId: string): Promise<any> {
    const d = this.dialect.reset();

    const checkInCount = await this.dataSource.query(
      `
            SELECT COUNT(*) as count FROM check_ins 
            WHERE ${d.cast("court_id", "TEXT")} = ${d.param()}
            AND checked_in_at > ${d.interval(30)}
        `,
      [courtId],
    );

    const matchCount = await this.dataSource.query(
      `
            SELECT COUNT(*) as count FROM matches 
            WHERE ${d.cast("court_id", "TEXT")} = ${d.param()}
        `,
      [courtId],
    );

    return {
      checkInsLast30Days: parseInt(checkInCount[0]?.count || "0", 10),
      totalMatches: parseInt(matchCount[0]?.count || "0", 10),
    };
  }

  // ==================== COURT CREATION ====================

  async createCourt(data: {
    id: string;
    name: string;
    city: string;
    lat: number;
    lng: number;
    indoor?: boolean;
    rims?: number;
    access?: string;
    venue_type?: string;
    address?: string;
  }): Promise<any> {
    try {
      if (this.dialect.isPostgres) {
        const result = await this.dataSource.query(
          `
                    INSERT INTO courts (id, name, city, indoor, rims, access, venue_type, address, source, geog)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'curated', ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        city = EXCLUDED.city,
                        indoor = EXCLUDED.indoor,
                        access = EXCLUDED.access,
                        venue_type = EXCLUDED.venue_type,
                        address = EXCLUDED.address,
                        geog = EXCLUDED.geog,
                        source = EXCLUDED.source
                    RETURNING id, name, city, access, venue_type, address
                `,
          [
            data.id,
            data.name,
            data.city,
            data.indoor ?? false,
            data.rims ?? 2,
            data.access ?? "public",
            data.venue_type ?? null,
            data.address ?? null,
            data.lng,
            data.lat,
          ],
        );

        return { success: true, court: result[0] };
      }

      // SQLite fallback
      await this.dataSource.query(
        `
                INSERT INTO courts (id, name, city, indoor, rims, lat, lng, venue_type, address, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user')
            `,
        [
          data.id,
          data.name,
          data.city,
          data.indoor ?? false,
          data.rims ?? 2,
          data.lat,
          data.lng,
          data.venue_type ?? null,
          data.address ?? null,
        ],
      );

      return { success: true, court: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
