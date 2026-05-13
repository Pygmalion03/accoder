#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    int minPrice = INT_MAX;
    int best = 0;
    for (int i = 0; i < n; ++i) {
        int price;
        cin >> price;
        minPrice = min(minPrice, price);
        best = max(best, price - minPrice);
    }
    cout << best << '\n';
    return 0;
}
