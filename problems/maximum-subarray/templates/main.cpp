#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    int current;
    cin >> current;
    int best = current;
    for (int i = 1; i < n; ++i) {
        int value;
        cin >> value;
        current = max(value, current + value);
        best = max(best, current);
    }
    cout << best << '\n';
    return 0;
}
