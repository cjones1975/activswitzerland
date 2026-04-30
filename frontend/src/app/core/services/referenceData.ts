import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';
import { Country } from '../../models/country';

interface CountriesResponse {
  success: boolean;
  count: number;
  data: Country[];
}

@Injectable({ providedIn: 'root' })
export class ReferenceData {
  private http = inject(HttpClient);

  async getCountries(): Promise<Country[]> {
    return firstValueFrom(
      this.http.get<CountriesResponse>('http://localhost:3000/api/v1/country/countries').pipe(
        map(res => res.data)
      )
    );
  }
}
