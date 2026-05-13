import sys


def main():
    data = list(map(int, sys.stdin.read().split()))
    n = data[0]
    prices = data[1 : 1 + n]
    min_price = prices[0]
    best = 0
    for price in prices:
        min_price = min(min_price, price)
        best = max(best, price - min_price)
    print(best)


if __name__ == "__main__":
    main()
