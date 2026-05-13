import sys


def main():
    n = int(sys.stdin.read().strip())
    a, b = 1, 1
    for _ in range(n):
        a, b = b, a + b
    print(a)


if __name__ == "__main__":
    main()
